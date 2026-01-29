import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'

// Load environment from .env.local or .env
function loadEnv() {
  const localEnv = path.resolve('.env.local')
  const env = path.resolve('.env')
  try {
    if (fs.existsSync(localEnv)) {
      const content = fs.readFileSync(localEnv, 'utf-8')
      content.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.+)\s*$/)
        if (m) process.env[m[1]] = m[2]
      })
    } else if (fs.existsSync(env)) {
      const content = fs.readFileSync(env, 'utf-8')
      content.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.+)\s*$/)
        if (m) process.env[m[1]] = m[2]
      })
    }
  } catch {}
}

loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment')
  process.exit(1)
}
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const DEFAULT_DIR = 'C:\\Users\\Meeting\\Desktop\\จัดการ IT\\database'
const DB_DIR = process.env.DATABASE_DIR || DEFAULT_DIR

function readCsv(filePath) {
  const input = fs.readFileSync(filePath, 'utf-8')
  const records = parse(input, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
  return records
}

async function importEmployees() {
  const file = path.join(DB_DIR, 'employees_rows.csv')
  if (!fs.existsSync(file)) {
    console.log('Skip employees: file not found')
    return
  }
  const rows = readCsv(file)
  if (!rows.length) return
  const { error } = await client.from('employees').insert(rows, { defaultToNull: true })
  if (error) throw new Error('employees: ' + error.message)
  console.log(`Imported employees: ${rows.length}`)
}

async function importComputers() {
  const file = path.join(DB_DIR, 'computers_rows.csv')
  if (!fs.existsSync(file)) {
    console.log('Skip computers: file not found')
    return
  }
  const rows = readCsv(file)
  const mapped = rows.map((r) => ({
    computer_id: r.computer_id || null,
    spec: r.spec || null,
    repair_history: r.repair_history || null,
    user_id: r.user_id || null,
    asset_type: r.asset_type || null,
    loan_borrower_name: r.loan_borrower_name || null,
    remarks: r.remarks || null,
  }))
  const { error } = await client.from('computers').insert(mapped, { defaultToNull: true })
  if (error) throw new Error('computers: ' + error.message)
  console.log(`Imported computers: ${mapped.length}`)
}

async function importPrinters() {
  const file = path.join(DB_DIR, 'printers_rows.csv')
  if (!fs.existsSync(file)) {
    console.log('Skip printers: file not found')
    return
  }
  const rows = readCsv(file)
  const mapped = rows.map((r) => ({
    printer_id: r.printer_id || null,
    model: r.model || null,
    user_id: r.user_id || null,
  }))
  const { error } = await client.from('printers').insert(mapped, { defaultToNull: true })
  if (error) throw new Error('printers: ' + error.message)
  console.log(`Imported printers: ${mapped.length}`)
}

async function main() {
  try {
    console.log('Import directory:', DB_DIR)
    await importEmployees()
    await importComputers()
    await importPrinters()
    console.log('All imports done.')
  } catch (e) {
    console.error('Import failed:', e.message)
    process.exit(1)
  }
}

main()
