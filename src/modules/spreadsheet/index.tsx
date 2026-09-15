/**
 * 表格页模块
 * 
 * 使用 AG Grid 实现可编程表格：
 * - 整页表格展示
 * - 单元格直接编辑
 * - 数据持久化（后端 JSON 存储）
 * - 支持筛选、排序、分页
 */
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Button, Input, Space, message, Tooltip, Popconfirm } from 'antd'
import * as XLSX from 'xlsx'
import { PlusOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'

// 注册所有社区模块
ModuleRegistry.registerModules([AllCommunityModule])

interface ColumnDef {
  field: string
  headerName: string
  width?: number
  editable?: boolean
  type?: 'text' | 'number' | 'date'
}

interface SheetData {
  id: string
  name: string
  columns: ColumnDef[]
  rows: Record<string, any>[]
}

// AG Grid 中文本地化
const localeText = {
  pageSize: '每页行数',
  morePages: '更多页',
  filterOob: '外框过滤',
  searchOob: '搜索...',
  checksum: '校验和',
  colGroupShow: '列组',
  columnSelector: '列选择器',
  filterBy: '筛选 {column}',
  groupDefaultTitle: '按组排列',
  loadingOob: '加载中...',
  noRowsShow: '无数据',
  noRowsToShow: '无数据',
  toolButton: '工具按钮',
  oRangeToolButton: '范围工具',
  resetToolButton: '重置工具',
  exportToolButton: '导出工具',
  filterPanel: '筛选面板',
  columnPanel: '列面板',
  rowsFilter: '行过滤器',
  selectAll: '全选',
  selectAllSearchResults: '全选搜索结果',
  searchOobPlaceholder: '搜索...',
  clearAll: '全部清除',
  applyFilters: '应用',
  expandColumn: '展开列',
  collapseColumn: '折叠列',
}

const STORAGE_KEY = 'mimo-spreadsheet-sheets'
const GRID_SIZE = 20

const SpreadsheetModule: React.FC = () => {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeSheet, setActiveSheet] = useState<string>('default')
  const [gridApi, setGridApi] = useState<any>(null)
  const [columnApi, setColumnApi] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 从后端加载数据
  const loadSheets = useCallback(async () => {
    try {
      const res = await fetch('/api/spreadsheet/sheets')
      if (res.ok) {
        const data = await res.json()
        setSheets(data)
        if (data.length > 0 && !data.find(s => s.id === activeSheet)) {
          setActiveSheet(data[0].id)
        }
      }
    } catch (err) {
      console.error('加载表格失败:', err)
    }
  }, [activeSheet])

  useEffect(() => {
    loadSheets()
  }, [loadSheets])

  // 获取当前 sheet
  const currentSheet = useMemo(() => 
    sheets.find(s => s.id === activeSheet) || sheets[0],
    [sheets, activeSheet]
  )

  // 表格列定义
  const columnDefs = useMemo<ColDef[]>(() => {
    if (!currentSheet) return []
    return currentSheet.columns.map(({ type, ...col }) => ({
      ...col,
      editable: col.editable !== false,
      filter: true,
      resizable: true,
    }))
  }, [currentSheet])

  // 表格行数据
  const rowData = useMemo(() => 
    currentSheet?.rows || [],
    [currentSheet]
  )

  // 初始化中文本地化

  // 表格就绪
  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api)
    setColumnApi(params.columnApi)
    params.api.sizeColumnsToFit()
  }

  // 单元格编辑后保存
  const onCellValueChanged = async (event: CellValueChangedEvent) => {
    if (!currentSheet) return
    
    const { data, colDef, value } = event
    if (!colDef.editable) return

    const updatedRows = (currentSheet.rows || []).map((row: any) => {
      if (row._id === data._id) {
        return { ...row, [colDef.field]: value }
      }
      return row
    })

    setSheets(prev => prev.map(s => 
      s.id === activeSheet ? { ...s, rows: updatedRows } : s
    ))

    try {
      const res = await fetch('/api/spreadsheet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: activeSheet, rows: updatedRows }),
      })
      if (!res.ok) throw new Error('保存失败')
    } catch {
      message.error('保存失败，请重试')
      setSheets(prev => prev.map(s => 
        s.id === activeSheet ? { ...s, rows: currentSheet.rows } : s
      ))
    }
  }

  // 添加新行
  const addRow = async () => {
    if (!currentSheet) return
    
    const newRow: Record<string, any> = { _id: Date.now().toString() }
    currentSheet.columns.forEach(col => {
      newRow[col.field] = col.type === 'number' ? 0 : ''
    })

    const updatedRows = [...(currentSheet.rows || []), newRow]
    
    setSheets(prev => prev.map(s => 
      s.id === activeSheet ? { ...s, rows: updatedRows } : s
    ))

    try {
      await fetch('/api/spreadsheet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: activeSheet, rows: updatedRows }),
      })
    } catch {
      message.error('添加失败')
    }
  }

  // 添加新列
  const addColumn = async () => {
    const name = prompt('请输入新列名:')
    if (!name) return

    const fieldName = `col_${Date.now()}`
    const updatedColumns = [...(currentSheet?.columns || []), {
      field: fieldName,
      headerName: name,
      editable: true,
    }]

    setSheets(prev => prev.map(s => 
      s.id === activeSheet ? { ...s, columns: updatedColumns } : s
    ))

    try {
      await fetch('/api/spreadsheet/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: activeSheet, columns: updatedColumns }),
      })
      message.success('列已添加')
    } catch {
      message.error('保存失败')
    }

    setTimeout(() => {
      gridApi?.sizeColumnsToFit()
    }, 100)
  }

  // 删除选中行
  const deleteSelected = async () => {
    const selected = gridApi?.getSelectedRows()
    if (!selected || selected.length === 0) {
      message.warning('请先选择要删除的行')
      return
    }

    const selectedIds = selected.map((r: any) => r._id)
    const updatedRows = (currentSheet?.rows || []).filter((r: any) => !selectedIds.includes(r._id))

    setSheets(prev => prev.map(s => 
      s.id === activeSheet ? { ...s, rows: updatedRows } : s
    ))

    try {
      await fetch('/api/spreadsheet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: activeSheet, rows: updatedRows }),
      })
      message.success(`已删除 ${selected.length} 行`)
    } catch {
      message.error('删除失败')
    }
  }

  // 导入 Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet)

        if (jsonData.length === 0) {
          message.warning('文件内容为空')
          return
        }

        // 获取列名
        const headers = Object.keys(jsonData[0])
        const columns = headers.map(h => ({
          field: h.toLowerCase().replace(/\s+/g, '_'),
          headerName: h,
          editable: true,
        }))

        // 转换数据
        const rows = jsonData.map((row, idx) => ({
          _id: `row_${Date.now()}_${idx}`,
          ...row,
        }))

        // 更新当前 sheet
        setSheets(prev => prev.map(s => 
          s.id === activeSheet ? { ...s, columns, rows } : s
        ))

        // 保存到后端
        fetch('/api/spreadsheet/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheetId: activeSheet, rows, columns }),
        }).then(() => message.success('导入成功！'))
        .catch(() => message.error('保存失败'))
      } catch {
        message.error('文件解析失败，请确保是有效的 Excel 文件')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // 导出 CSV
  const exportCSV = () => {
    if (!currentSheet) return
    
    const headers = currentSheet.columns.map(c => c.headerName).join(',')
    const rows = (currentSheet.rows || []).map(row => 
      currentSheet.columns.map(col => row[col.field] ?? '').join(',')
    ).join('\n')

    const csv = `${headers}\n${rows}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentSheet.name}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 初始化默认数据
  useEffect(() => {
    if (sheets.length === 0) {
      const defaultSheet: SheetData = {
        id: 'default',
        name: '默认表格',
        columns: [
          { field: 'name', headerName: '名称', editable: true, width: 150 },
          { field: 'value', headerName: '数值', editable: true, width: 100 },
          { field: 'note', headerName: '备注', editable: true, width: 200 },
        ],
        rows: Array.from({ length: GRID_SIZE }, (_, i) => ({
          _id: `row_${i}`,
          name: `项目 ${i + 1}`,
          value: i * 10,
          note: '',
        })),
      }
      setSheets([defaultSheet])
      
      fetch('/api/spreadsheet/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets: [defaultSheet] }),
      }).catch(console.error)
    }
  }, [sheets.length])

  if (!currentSheet) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ color: '#999' }}>加载中...</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
      {/* 工具栏 */}
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()} style={{ fontWeight: 600 }}>导入</Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleImportExcel}
          />
          <Button icon={<PlusOutlined />} onClick={addRow}>添加行</Button>
          <Button icon={<PlusOutlined />} onClick={addColumn}>添加列</Button>
          <Popconfirm
            title="确认删除选中的行？"
            onConfirm={deleteSelected}
            okText="删除"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} danger>删除选中</Button>
          </Popconfirm>
        </Space>
        <Space style={{ marginLeft: 'auto' }}>
          <Tooltip title="刷新数据">
            <Button icon={<ReloadOutlined />} onClick={loadSheets} />
          </Tooltip>
          <Tooltip title="导出 CSV">
            <Button icon={<DownloadOutlined />} onClick={exportCSV}>导出 CSV</Button>
          </Tooltip>
        </Space>
      </div>

      {/* AG Grid */}
      <div
        className="ag-theme-alpine"
        style={{ flex: 1, minWidth: 0 }}
      >
        <AgGridReact
          columnDefs={columnDefs}
          rowData={rowData}
          localeText={localeText}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          domLayout="normal"
          rowHeight={32}
          headerHeight={32}
          animateRows={true}
          enableCellTextSelection={true}
          suppressRowClickSelection={true}
          pagination={true}
          paginationPageSize={50}
          suppressExcelExport={true}
          theme="legacy"
          suppressFieldDotNotation={true}
        />
      </div>
    </div>
  )
}

export default SpreadsheetModule
