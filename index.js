const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')
const { select, input } = require('@inquirer/prompts')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const { format } = require('date-fns')
const readline = require('readline')

// Function to prompt the user to select a serial port
async function selectSerialPort () {
  const ports = await SerialPort.list()

  if (ports.length === 0) {
    console.log('No serial ports found')
    process.exit(1)
  }

  const portChoices = ports.map(port => ({
    name: `${port.path} - ${port.manufacturer || 'Unknown Manufacturer'}`,
    value: port.path
  }))

  const selectedPort = await select({
    message: 'Select a serial port:',
    choices: portChoices
  })

  return selectedPort
}

async function defineFileName () {
  const now = new Date()
  const answer = await input({
    message: 'Enter the filename',
    default: `${format(now, 'yyyyMMdd_hhmmss')}_data`
  })
  return answer
}

async function run () {
  try {
    let isLogging = false
    // Configure readline for command-line input
    const filename = await defineFileName()
    const path = `data/${filename}.csv`
    const csvWriter = createCsvWriter({
      path,
      header: [
        { id: 'time_since_tare' },
        { id: 'raw' },
        { id: 'raw_weight' },
        { id: 'raw_error' }
      ],
      append: true
    })

    const selectedPortPath = await selectSerialPort()

    const port = new SerialPort({ path: selectedPortPath, baudRate: 115200 })
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }))

    port.on('open', () => {
      console.log(`Serial port ${selectedPortPath} open`)
    })

    // Read data from the serial port
    parser.on('data', (line) => {
      const incomingString = line.trim()
      const entries = incomingString.split(',')
      console.log(!isLogging ? 'Not logging..' : 'Logged: ', entries)
      if (isLogging) {
        csvWriter.writeRecords([{
          time_since_tare: entries[0],
          raw: entries[1],
          raw_weight: entries[2],
          raw_error: entries[3]
        }])
      }
    })

    // Error handling
    port.on('error', (err) => {
      console.error('Error: ', err.message)
    })

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.on('line', (input) => {
      console.log(`Received: ${input}`)
      const cmd = input.trim()
      if (cmd.includes('s')) {
        console.log('Started logging!')
        isLogging = true
      }
      port.write(cmd)
      console.log(cmd)
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

run()
