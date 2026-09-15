/usr/bin/bash: warning: setlocale: LC_ALL: cannot change locale (zh-CN): No such file or directory
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
  // Set Filter
  selectAll: '(全选)',
  selectAllSearchResults: '全选搜索结果',
  searchOoo: '搜索...',
  blanks: '(空白)',
  noMatches: '无匹配',
  
  // Number Filter & Text Filter
  filterOoo: '筛选...',
  equals: '等于',
  notEqual: '不等于',
  blank: '空',
  notBlank: '非空',
  empty: '请选择',
  
  // Number Filter
  lessThan: '小于',
  greaterThan: '大于',
  lessThanOrEqual: '小于等于',
  greaterThanOrEqual: '大于等于',
  inRange: '范围内',
  inRangeStart: '从',
  inRangeEnd: '到',
  
  // Text Filter
  contains: '包含',
  notContains: '不包含',
  startsWith: '开始于',
  endsWith: '结束于',
  
  // Date Filter
  dateFormatOoo: 'yyyy-mm-dd',
  
  // Filter Conditions
  andCondition: '且',
  orCondition: '或',
  
  // Filter Buttons
  applyFilter: '应用',
  resetFilter: '重置',
  clearFilter: '清除',
  cancelFilter: '取消',
  
  // Filter Titles
  textFilter: '文本筛选',
  numberFilter: '数字筛选',
  dateFilter: '日期筛选',
  setFilter: '集合筛选',
  
  // Side Bar
  columns: '列',
  filters: '筛选',
  
  // columns tool panel
  pivotMode: '透视模式',
  groups: '行分组',
  rowGroupColumnsEmptyMessage: '拖拽至此设置行分组',
  values: '值',
  valueColumnsEmptyMessage: '拖拽至此进行聚合',
  pivots: '列标签',
  pivotColumnsEmptyMessage: '拖拽至此设置列标签',
  
  // Header of the Default Group Column
  group: '分组',
  
  // Row Drag
  rowDragRows: '行',
  
  // Other
  loadingOoo: '加载中...',
  noRowsToShow: '无数据',
  enabled: '已启用',
  
  // Menu
  pinColumn: '固定列',
  pinLeft: '固定左侧',
  pinRight: '固定右侧',
  noPin: '不固定',
  valueAggregation: '值聚合',
  autosizeThiscolumn: '自动调整此列',
  autosizeAllColumns: '自动调整所有列',
  groupBy: '按此分组',
  ungroupBy: '取消分组',
  addToValues: '添加到值',
  removeFromValues: '从值中移除',
  addToLabels: '添加到标签',
  removeFromLabels: '从标签中移除',
  resetColumns: '重置列',
  expandAll: '展开全部',
  collapseAll: '折叠全部',
  copy: '复制',
  ctrlC: 'Ctrl+C',
  copyWithHeaders: '带表头复制',
  copyWithGroupHeaders: '带分组表头复制',
  paste: '粘贴',
  ctrlV: 'Ctrl+V',
  export: '导出',
  csvExport: 'CSV 导出',
  excelExport: 'Excel 导出',
  
  // Status Bar
  sum: '求和',
  min: '最小',
  max: '最大',
  none: '无',
  count: '计数',
  avg: '平均',
  filteredRows: '筛选后',
  selectedRows: '选中',
  totalRows: '总行',
  totalAndFilteredRows: '行',
  more: '更多',
  to: '至',
  of: '/',
  page: '页',
  nextPage: '下一页',
  lastPage: '最后一页',
  firstPage: '第一页',
  previousPage: '上一页',
  
  // Pivoting
  pivotColumnGroupTotals: '合计',
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
