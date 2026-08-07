import { DownloadIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminExportRow } from "@/lib/api";

import { formatDateTime } from "./admin-format";

/**
 * "Ai đã xuất video" — mỗi lần dựng xong bản cuối (job `export` trạng thái `done`)
 * là một dòng: dự án nào, ai, lúc nào. Mới nhất trước.
 */
export function AdminExportsTable({ exports }: { exports: AdminExportRow[] }) {
  return (
    <Card className="min-h-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DownloadIcon className="size-4 text-primary" />
          Export gần đây ({exports.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="[&_[data-slot=table-container]]:max-h-[26rem]">
        {exports.length === 0 ? (
          <Empty className="py-10">
            <EmptyTitle>Chưa có ai xuất video</EmptyTitle>
            <EmptyDescription>
              Lần dựng xong bản cuối đầu tiên sẽ hiện ở đây.
            </EmptyDescription>
          </Empty>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Dự án</TableHead>
                <TableHead>Người xuất</TableHead>
                <TableHead>Lúc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exports.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="max-w-56 truncate font-medium" title={row.title}>
                    {row.title}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {row.ownerEmail ?? "— (cũ)"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(row.at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
