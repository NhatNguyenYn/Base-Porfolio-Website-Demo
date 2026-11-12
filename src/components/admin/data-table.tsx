import { cn } from "@/lib/utils";

export type Column = { key: string; label: string; className?: string };
export type Row = { id: string; cells: Record<string, React.ReactNode> };

export function DataTable({
  columns,
  rows,
  empty,
  className,
}: {
  columns: Column[];
  rows: Row[];
  empty?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto border border-line bg-surface", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-surface-muted/60">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted",
                  column.className,
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[13px] text-muted">
                {empty ?? "Chưa có dữ liệu."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-surface-muted/40">
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3 align-middle text-[12.5px]", column.className)}>
                    {row.cells[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
