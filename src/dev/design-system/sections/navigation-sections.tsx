import { FolderIcon, HomeIcon, SearchIcon, SettingsIcon } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const breadcrumbSection: ShowcaseSection = {
  id: "breadcrumb",
  title: "Breadcrumb",
  description: "Đường dẫn phân cấp tới trang hiện tại.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#breadcrumb">Trang chủ</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#breadcrumb">Dự án</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Bản dựng 12</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ),
    },
    {
      name: "Rút gọn ở giữa",
      node: (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#breadcrumb">Trang chủ</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Chi tiết</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ),
    },
  ],
};

const paginationSection: ShowcaseSection = {
  id: "pagination",
  title: "Pagination",
  description: "Phân trang cho danh sách dài.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#pagination" text="Trước" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#pagination">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#pagination" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#pagination">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#pagination" text="Sau" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ),
    },
  ],
};

const tabsSection: ShowcaseSection = {
  id: "tabs",
  title: "Tabs",
  description: "Chuyển giữa các khung nội dung cùng cấp.",
  cases: [
    {
      name: "Mặc định",
      node: (
        <Tabs defaultValue="account" className="w-80">
          <TabsList>
            <TabsTrigger value="account">Tài khoản</TabsTrigger>
            <TabsTrigger value="password">Mật khẩu</TabsTrigger>
            <TabsTrigger value="locked" disabled>
              Bị khoá
            </TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            Thông tin tài khoản của bạn.
          </TabsContent>
          <TabsContent value="password">Đổi mật khẩu định kỳ.</TabsContent>
        </Tabs>
      ),
    },
    {
      name: "Variant line",
      node: (
        <Tabs defaultValue="overview" className="w-80">
          <TabsList variant="line">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="report">Báo cáo</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Nội dung tổng quan.</TabsContent>
          <TabsContent value="report">Nội dung báo cáo.</TabsContent>
        </Tabs>
      ),
    },
    {
      // Dùng khi tab nằm ngay trong `CardHeader` — hai tiêu đề cạnh nhau, cái
      // không mở thì mờ. Thẻ chỉ có một tên, và tên đó là thứ đang xem.
      name: "Variant title",
      node: (
        <Tabs defaultValue="soat" className="w-80">
          <TabsList variant="title">
            <TabsTrigger value="soat">Cần bạn xem</TabsTrigger>
            <TabsTrigger value="sua">Đang sửa</TabsTrigger>
          </TabsList>
          <TabsContent value="soat">Danh sách chỗ cần xem lại.</TabsContent>
          <TabsContent value="sua">Khung sửa thứ đang chọn.</TabsContent>
        </Tabs>
      ),
    },
    {
      name: "Dọc",
      node: (
        <Tabs defaultValue="general" orientation="vertical" className="w-80">
          <TabsList>
            <TabsTrigger value="general">Chung</TabsTrigger>
            <TabsTrigger value="advanced">Nâng cao</TabsTrigger>
          </TabsList>
          <TabsContent value="general">Thiết lập chung.</TabsContent>
          <TabsContent value="advanced">Thiết lập nâng cao.</TabsContent>
        </Tabs>
      ),
    },
  ],
};

const sidebarSection: ShowcaseSection = {
  id: "sidebar",
  title: "Sidebar",
  description: "Khung điều hướng dọc với nhóm, menu con và huy hiệu.",
  cases: [
    {
      name: "Đầy đủ thành phần",
      node: (
        <SidebarProvider className="min-h-0 w-full">
          <div className="h-96 w-64 overflow-hidden rounded-xl">
            <Sidebar collapsible="none" className="w-full">
              <SidebarHeader>
                <SidebarInput placeholder="Tìm kiếm" />
              </SidebarHeader>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Chính</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton isActive>
                          <HomeIcon />
                          Bảng điều khiển
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <FolderIcon />
                          Dự án
                        </SidebarMenuButton>
                        <SidebarMenuBadge>8</SidebarMenuBadge>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton>
                              Đang chạy
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton>Lưu trữ</SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <SearchIcon />
                          Tìm kiếm
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
              <SidebarFooter>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <SettingsIcon />
                      Cài đặt
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarFooter>
            </Sidebar>
          </div>
        </SidebarProvider>
      ),
    },
  ],
};

export const navigationSections: ShowcaseSection[] = [
  breadcrumbSection,
  paginationSection,
  tabsSection,
  sidebarSection,
];
