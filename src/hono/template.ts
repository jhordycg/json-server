async function downloadTemplate() {
  const templateUrl = import.meta.resolve('../../views/index.html')
  const response = await fetch(templateUrl)
  if (!response.ok) {
    throw new Error(`Failed to download template: ${response.statusText}`)
  }
  return await response.text()
}

export const template: string = await downloadTemplate()
