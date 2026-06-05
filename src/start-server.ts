#!/usr/bin/env -S deno run --allow-env --ext=ts 
import { parseArgs } from '@std/cli/parse-args'
import { existsSync } from '@std/fs/exists'
import { readFileSync } from '@std/fs/unstable-read-file'
import { writeTextFileSync as writeFileSync } from '@std/fs/unstable-write-text-file'

import * as colors from '@std/fmt/colors'

import type { RouterRoute } from '@hono/hono/types'
import { createApp } from './hono/factory.ts'

function printHelp() {
  console.log(`Usage: json-server [options] <file>

Options:
  -p, --port <port>  Port (default: 3000)
  -h, --host <host>  Host (default: 127.0.0.1)
  --help             Show this message
`)
}

const {
  help,
  port = 3000,
  host = '127.0.0.1',
  _: [file],
} = parseArgs(Deno.args, {
  collect: ['static'],
  string: ['port', 'host'],
  boolean: ['help', 'version'],
  alias: {
    p: 'port',
    h: 'host',
    s: 'static',
  },
})

if (help) {
  printHelp()
  Deno.exit(1)
}

const decoder = new TextDecoder('utf-8')

if (typeof file !== 'string' || !existsSync(file)) {
  console.log(colors.red(`File ${file} not found`))
  Deno.exit(1)
}

// Handle empty string JSON file
const fileContent = decoder.decode(readFileSync(file))
if (fileContent.trim() === '') {
  writeFileSync(file, '{}')
}

// Create app
const app = await createApp(file)
const kaomojis = ['♡⸜(˶˃ ᵕ ˂˶)⸝♡', '♡( ◡‿◡ )', '( ˶ˆ ᗜ ˆ˵ )', '(˶ᵔ ᵕ ᵔ˶)']

function randomItem(items: string[]): string {
  const index = Math.floor(Math.random() * items.length)
  return items.at(index) ?? ''
}

const server = Deno.serve({ port: Number(port), hostname: host }, app.fetch)

printServerInfo(server.addr)
logRoutes(app.routes, server.addr)

function printServerInfo(address: Deno.NetAddr) {
  console.log(
    [
      colors.bold(`JSON Server started on PORT :${port}`),
      colors.gray('Press CTRL-C to stop'),
      colors.gray(`Watching ${file}...`),
      '',
      colors.magenta(randomItem(kaomojis)),
      '',
      colors.bold('Index:'),
      colors.gray(
        `http://${address.hostname}:${address.port}/`,
      ),
      '',
      colors.bold('Static files:'),
      colors.gray('Serving ./public directory if it exists'),
      '',
    ].join('\n'),
  )
}

function logRoutes(routes: RouterRoute[], address: Deno.NetAddr) {
  console.log(colors.bold('Endpoints:'))
  const baseURL = `http://${address.hostname}:${address.port}`
  const endpoints = new Set(
    routes
      .filter((route) => route.method !== 'ALL')
      .map((route) => route.basePath),
  )
  if (endpoints.size === 0) {
    console.log(
      colors.gray(`No endpoints found, try adding some data to ${file}`),
    )
    return
  }
  console.log(
    endpoints.values()
      .map((endpoint) => `${colors.gray(baseURL)}${colors.blue(endpoint)}`)
      .toArray()
      .join('\n'),
  )
}
