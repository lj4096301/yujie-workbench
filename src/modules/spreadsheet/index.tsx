import React, { useEffect, useState, useRef } from 'react'
import { Button, Space, message, Tooltip, Popconfirm } from 'antd'
import { PlusOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import 'tabulator-tables/dist/css/tabulator.min.css'

interface ColumnDef {
  field: string
  title: string
  width?: number
}

const SpreadsheetModule: React.FC = () => {
  const [data, setData] = useState<{columns: ColumnDef[], rows: any[]}>({ columns: [], rows: [] })
  const [initialized, setInitialized] = useState(false)
  const tableRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/spreadsheet/sheets')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(sheets => {
        if (sheets.length > 0) {
          setData({ columns: sheets[0].columns, rows: sheets[0].rows })
        } else {
          const defaultCols = [
            { field: 'name', title: '名称', width: 150 },
            { field: 'value', title: '数值', width: 100 },
            { field: 'note', title: '备注', width: 200 }
          ]
          const defaultRows = Array.from({ length: 20 }, (_, i) => ({
            _id: `row_${i}`,
            name: `项目 ${i + 1}`,
            value: i * 10,
            note: ''
          }))
          setData({ columns: defaultCols, rows: defaultRows })
          saveData(defaultCols, defaultRows)
        }
        setInitialized(true)
      })
      .catch(() => {
        const defaultCols = [
          { field: 'name', title: '名称', width: 150 },
          { field: 'value', title: '数值', width: 100 },
          { field: 'note', title: '备注', width: 200 }
        ]
        const defaultRows = Array.from({ length: 20 }, (_, i) => ({
          _id: `row_${i}`,
          name: `项目 ${i + 1}`,
          value: i * 10,
          note: ''
        }))
        setData({ columns: defaultCols, rows: defaultRows })
        setInitialized(true)
      })
  }, [])

  useEffect(() => {
    if (!initialized || !data.columns.length) return
    
    ;(async () => {
    const module = await import('tabulator-tables')
    const Tabulator = module.default || module
    const el = document.getElementById('spreadsheet-table')
    if (!el || tableRef.current) return

    const columns = data.columns.map((col, idx) => ({
      title: col.title,
      field: col.field,
      width: col.width || 120,
      editable: idx > 0,
      headerSort: true,
    }))

      tableRef.current = new Tabulator(el, {
      data: data.rows,
      columns: columns,
      layout: 'fitDataFill',
      resizableRows: true,
      pagination: true,
      paginationSize: 20,
      movableColumns: true,
      selectableRows: 1,
      headerVisible: true,
      placeholder: '<span style="color:#999;padding:20px 0">暂无数据</span>',
    })
    })()
  }, [initialized, data])

  const saveData = async (cols: ColumnDef[], rows: any[]) => {
    try {
      await fetch('/api/spreadsheet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: cols, rows })
      })
    } catch (e) {
      console.error('保存失败', e)
    }
  }

  const addRow = () => {
    const newId = `row_${Date.now()}`
    const newRow: any = { _id: newId }
    data.columns.forEach(col => newRow[col.field] = '')
    
    const newRows = [...data.rows, newRow]
    setData({ ...data, rows: newRows })
    tableRef.current?.addRow(newRow, undefined, false)
    saveData(data.columns, newRows)
    message.success('已添加行')
  }

  const deleteSelected = async () => {
    const selected = tableRef.current?.getSelectedRows()
    if (!selected || selected.length === 0) {
      message.warning('请先选择要删除的行')
      return
    }
    
    const selectedIds = selected.map((r: any) => r._id)
    const newRows = data.rows.filter((r: any) => !selectedIds.includes(r._id))
    
    setData({ ...data, rows: newRows })
    selected.forEach((r: any) => r.delete())
    saveData(data.columns, newRows)
    message.success(`已删除 ${selected.length} 行`)
  }

  const addColumn = async () => {
    const name = prompt('请输入列名:')
    if (!name) return

    const field = `col_${Date.now()}`
    const newCol: ColumnDef = { field, title: name, width: 120 }
    const newColumns = [...data.columns, newCol]
    
    setData({ ...data, columns: newColumns })
    tableRef.current?.addColumn({ title: name, field, width: 120 }, undefined, true)
    await saveData(newColumns, data.rows)
    message.success('列已添加')
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet)

        if (jsonData.length === 0) {
          message.warning('文件内容为空')
          return
        }

        const headers = Object.keys(jsonData[0])
        const columns = headers.map(h => ({
          field: h.toLowerCase().replace(/\s+/g, '_'),
          title: h,
          width: 120
        }))

        const rows = jsonData.map((row: any, idx: number) => ({
          _id: `row_${Date.now()}_${idx}`,
          ...row
        }))

        setData({ columns, rows })
        tableRef.current?.replaceData(rows)
        saveData(columns, rows)
        message.success('导入成功')
      } catch {
        message.error('文件解析失败')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const exportCSV = () => {
    if (!data.rows.length) {
      message.warning('暂无数据')
      return
    }

    const headers = data.columns.map(c => c.title).join(',')
    const rows = data.rows.map(row => 
      data.columns.map(col => row[col.field] ?? '').join(',')
    ).join('\n')

    const csv = `${headers}\n${rows}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '导出数据.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        padding: '8px 12px', 
        borderBottom: '1px solid #e5e6eb',
        background: '#fff'
      }}>
        <Space>
          <Button 
            icon={<UploadOutlined />} 
            onClick={() => fileInputRef.current?.click()}
            size="small"
            style={{ fontWeight: 600 }}
          >
            导入
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleImportExcel}
          />
          <Button icon={<PlusOutlined />} onClick={addRow} size="small">添加行</Button>
          <Button icon={<PlusOutlined />} onClick={addColumn} size="small">添加列</Button>
          <Popconfirm
            title="确认删除选中的行？"
            onConfirm={deleteSelected}
            okText="删除"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} danger size="small">删除选中</Button>
          </Popconfirm>
        </Space>
        <Space style={{ marginLeft: 'auto' }}>
          <Tooltip title="导出 CSV">
            <Button icon={<DownloadOutlined />} onClick={exportCSV} size="small">导出</Button>
          </Tooltip>
          <Tooltip title="保存所有数据">
            <Button 
              icon={<SaveOutlined />} 
              onClick={() => {
                saveData(data.columns, data.rows)
                message.success('保存成功')
              }}
              type="primary"
              size="small"
            >
              保存
            </Button>
          </Tooltip>
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
        <div id="spreadsheet-table" style={{ height: '100%' }}></div>
      </div>
    </div>
  )
}

export default SpreadsheetModule
