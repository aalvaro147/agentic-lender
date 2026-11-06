/* A table column header that sorts the table when clicked.
   aria-sort tells screen readers which column is sorted and in which direction.
   Story: WEB-23 */

export function SortableHeader({ label, column, sort, onSort, align = 'left' }) {
  const isActive = sort.key === column
  const direction = sort.direction === 'asc' ? 'ascending' : 'descending'

  return (
    <th
      scope="col"
      aria-sort={isActive ? direction : 'none'}
      className={`px-4 py-3 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-navy ${
          isActive ? 'text-navy' : ''
        }`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">
          {isActive ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}
