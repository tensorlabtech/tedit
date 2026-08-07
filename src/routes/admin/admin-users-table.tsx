import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

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
import type { AdminUserRow } from "@/lib/api";

import { formatBytes, formatDate, formatDuration } from "./admin-format";

/**
 * Bảng người dùng cho màn quản trị. Có ô tìm để lọc khi danh sách dài, thead dính
 * lại khi cuộn, và số căn phải + `tabular-nums` để cột số thẳng hàng dù nhiều dòng.
 */
export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(q) ||
        (user.name ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <Card className="min-h-0">
      <CardHeader>
        <CardTitle>
          Người dùng (
          {filtered.length === users.length
            ? users.length
            : `${filtered.length}/${users.length}`}
          )
        </CardTitle>
        <CardAction>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm email hoặc tên"
              className="h-9 w-56 pl-8"
            />
          </div>
        </CardAction>
      </CardHeader>
      {/* Bó chiều cao khung bảng để nó tự cuộn khi nhiều dòng — lúc đó thead dính
          lại được (Table tự bọc một vùng cuộn, nên phải bó ngay trên vùng đó). */}
      <CardContent className="[&_[data-slot=table-container]]:max-h-[26rem]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Tham gia</TableHead>
              <TableHead className="text-right">Export</TableHead>
              <TableHead className="text-right">Dự án</TableHead>
              <TableHead className="text-right">Media</TableHead>
              <TableHead className="text-right">Dung lượng</TableHead>
              <TableHead className="text-right">Giờ video</TableHead>
              <TableHead>Lần cuối</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/40">
                <TableCell className="max-w-56 truncate font-medium" title={user.email}>
                  {user.email}
                </TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">
                  {user.name ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {user.exports > 0 ? (
                    <span className="font-medium text-primary">{user.exports}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {user.projects}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {user.media}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatBytes(user.mediaBytes)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatDuration(user.videoSeconds)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(user.lastProjectAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 ? (
          <Empty className="py-10">
            <EmptyTitle>Không có người dùng khớp</EmptyTitle>
            <EmptyDescription>Thử từ khoá khác.</EmptyDescription>
          </Empty>
        ) : null}
      </CardContent>
    </Card>
  );
}
