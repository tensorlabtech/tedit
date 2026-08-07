import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminRecentProject } from "@/lib/api";

import { formatDate, formatDuration, statusOf } from "./admin-format";

/**
 * Bảng dự án gần đây. Máy chủ trả 24 dự án mới nhất; ô tìm lọc trong số đó theo
 * tiêu đề hoặc email chủ. thead dính khi cuộn.
 */
export function AdminProjectsTable({
  projects,
}: {
  projects: AdminRecentProject[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (project) =>
        project.title.toLowerCase().includes(q) ||
        (project.ownerEmail ?? "").toLowerCase().includes(q),
    );
  }, [projects, query]);

  return (
    <Card className="min-h-0">
      <CardHeader>
        <CardTitle>Dự án gần đây</CardTitle>
        <CardAction>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tiêu đề hoặc chủ"
              className="h-9 w-56 pl-8"
            />
          </div>
        </CardAction>
      </CardHeader>
      {/* Bó chiều cao khung bảng để nó tự cuộn khi nhiều dòng — lúc đó thead dính. */}
      <CardContent className="[&_[data-slot=table-container]]:max-h-[26rem]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Tiêu đề</TableHead>
              <TableHead>Chủ</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Giờ video</TableHead>
              <TableHead>Tạo lúc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((project) => (
              <TableRow key={project.id} className="hover:bg-muted/40">
                <TableCell className="max-w-56 truncate font-medium" title={project.title}>
                  {project.title}
                </TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {project.ownerEmail ?? "— (cũ)"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusOf(project.status).variant}>
                    {statusOf(project.status).label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatDuration(project.videoSeconds)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(project.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 ? (
          <Empty className="py-10">
            <EmptyTitle>Không có dự án khớp</EmptyTitle>
            <EmptyDescription>Thử từ khoá khác.</EmptyDescription>
          </Empty>
        ) : null}
      </CardContent>
    </Card>
  );
}
