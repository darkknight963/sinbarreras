import React from 'react'

interface TableColumn {
  key: string
  label: string
}

interface TableRow {
  id: string
  [key: string]: any
}

interface TableProps {
  columns: TableColumn[]
  rows: TableRow[]
  onRowHover?: (rowId: string) => void
  hoverable?: boolean
}

export const Table: React.FC<TableProps> = ({
  columns,
  rows,
  onRowHover,
  hoverable = true,
}) => {
  return (
    <table className="report-table w-full">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className={hoverable ? 'report-row-hover' : ''}
            onMouseEnter={() => onRowHover?.(row.id)}
          >
            {columns.map((col) => (
              <td key={`${row.id}-${col.key}`}>{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
