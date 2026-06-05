import { existsSync } from '@std/fs'
import { readFileSync } from '@std/fs/unstable-read-file'
import { writeFileSync } from '@std/fs/unstable-write-file'
import {} from '@std/io'

import { extname } from '@std/path'
import chalk from 'chalk'
import JSON5 from 'json5'
import { Low } from 'lowdb'
import { DataFile, JSONFile } from 'lowdb/node'

import type { RawData } from '../../adapters/normalized-adapter.ts'
import { NormalizedAdapter } from '../../adapters/normalized-adapter.ts'
import { Observer } from '../../adapters/observer.ts'
import type { Data } from '../../service.ts'

export async function setupDb(file: string): Promise<Low<Data>> {
  if (!existsSync(file)) {
    console.log(chalk.red(`File ${file} not found`))
    throw new Error(`File ${file} not found`)
  }

  // Set up database
  const adapter = prepareDbFile(file)

  const observer = new Observer(new NormalizedAdapter(adapter))

  const db = new Low<Data>(observer, {})
  await db.read()
  return db
}

function prepareDbFile(file: string) {
  // Handle empty string JSON file
  const fileDecoder = new TextDecoder('utf-8')
  const fileEncoder = new TextEncoder()

  const fileContent = fileDecoder.decode(readFileSync(file))

  if (fileContent.trim() === '') {
    writeFileSync(file, fileEncoder.encode('{}'))
  }

  // Set up database
  if (extname(file) !== '.json5') {
    return new JSONFile<RawData>(file)
  }
  return new DataFile<RawData>(file, {
    parse: JSON5.parse,
    stringify: JSON5.stringify,
  })
}
