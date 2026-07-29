import { CreditCardIcon, MailIcon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const inputSection: ShowcaseSection = {
  id: "input",
  title: "Input",
  description: "Ô nhập một dòng, kèm các kiểu dữ liệu và trạng thái.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <>
          <Input placeholder="Nhập nội dung" className="w-56" />
          <Input defaultValue="Đã có giá trị" className="w-56" />
        </>
      ),
    },
    {
      name: "Theo kiểu dữ liệu",
      node: (
        <>
          <Input type="email" placeholder="email@vidu.com" className="w-56" />
          <Input type="password" placeholder="Mật khẩu" className="w-56" />
          <Input type="number" placeholder="0" className="w-24" />
          <Input type="date" className="w-40" />
          <Input type="file" className="w-56" />
        </>
      ),
    },
    {
      name: "Trạng thái",
      node: (
        <>
          <Input placeholder="Disabled" disabled className="w-56" />
          <Input defaultValue="Sai định dạng" aria-invalid className="w-56" />
          <Input readOnly defaultValue="Chỉ đọc" className="w-56" />
        </>
      ),
    },
    {
      name: "Kèm nhãn",
      node: (
        <div className="grid w-56 gap-2">
          <Label htmlFor="demo-input-email">Email</Label>
          <Input
            id="demo-input-email"
            type="email"
            placeholder="email@vidu.com"
          />
        </div>
      ),
    },
  ],
};

const textareaSection: ShowcaseSection = {
  id: "textarea",
  title: "Textarea",
  description: "Ô nhập nhiều dòng.",
  cases: [
    {
      name: "Cơ bản",
      node: <Textarea placeholder="Nhập mô tả" className="w-72" />,
    },
    {
      name: "Trạng thái",
      node: (
        <>
          <Textarea placeholder="Disabled" disabled className="w-56" />
          <Textarea
            defaultValue="Nội dung không hợp lệ"
            aria-invalid
            className="w-56"
          />
        </>
      ),
    },
    {
      name: "Kèm nhãn",
      node: (
        <div className="grid w-72 gap-2">
          <Label htmlFor="demo-textarea-note">Ghi chú</Label>
          <Textarea
            id="demo-textarea-note"
            rows={4}
            placeholder="Nội dung ghi chú"
          />
        </div>
      ),
    },
  ],
};

const labelSection: ShowcaseSection = {
  id: "label",
  title: "Label",
  description: "Nhãn cho các trường nhập liệu.",
  cases: [
    {
      name: "Cơ bản",
      node: <Label htmlFor="demo-label-input">Tên hiển thị</Label>,
    },
    {
      name: "Gắn với input",
      node: (
        <div className="grid w-56 gap-2">
          <Label htmlFor="demo-label-input">Tên hiển thị</Label>
          <Input id="demo-label-input" placeholder="Nguyễn Văn A" />
        </div>
      ),
    },
  ],
};

const nativeSelectSection: ShowcaseSection = {
  id: "native-select",
  title: "Native Select",
  description: "Thẻ select gốc của trình duyệt, dùng cho form đơn giản.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <NativeSelect defaultValue="hcm">
          <NativeSelectOption value="hn">Hà Nội</NativeSelectOption>
          <NativeSelectOption value="hcm">TP. Hồ Chí Minh</NativeSelectOption>
          <NativeSelectOption value="dn">Đà Nẵng</NativeSelectOption>
        </NativeSelect>
      ),
    },
    {
      name: "Size sm + nhóm lựa chọn",
      node: (
        <NativeSelect size="sm" defaultValue="react">
          <NativeSelectOptGroup label="Frontend">
            <NativeSelectOption value="react">React</NativeSelectOption>
            <NativeSelectOption value="vue">Vue</NativeSelectOption>
          </NativeSelectOptGroup>
          <NativeSelectOptGroup label="Backend">
            <NativeSelectOption value="nest">NestJS</NativeSelectOption>
          </NativeSelectOptGroup>
        </NativeSelect>
      ),
    },
    {
      name: "Trạng thái",
      node: (
        <>
          <NativeSelect disabled>
            <NativeSelectOption>Disabled</NativeSelectOption>
          </NativeSelect>
          <NativeSelect aria-invalid>
            <NativeSelectOption>Không hợp lệ</NativeSelectOption>
          </NativeSelect>
        </>
      ),
    },
  ],
};

const inputGroupSection: ShowcaseSection = {
  id: "input-group",
  title: "Input Group",
  description: "Ô nhập gắn thêm icon, chữ hoặc nút ở các cạnh.",
  cases: [
    {
      name: "Icon đầu dòng",
      node: (
        <InputGroup className="w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Tìm kiếm" />
        </InputGroup>
      ),
    },
    {
      name: "Chữ và phím tắt cuối dòng",
      node: (
        <InputGroup className="w-72">
          <InputGroupAddon>
            <MailIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="tên tài khoản" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>@teddit.vn</InputGroupText>
            <Kbd>⏎</Kbd>
          </InputGroupAddon>
        </InputGroup>
      ),
    },
    {
      name: "Nút bên trong",
      node: (
        <InputGroup className="w-72">
          <InputGroupAddon>
            <CreditCardIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Mã giảm giá" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton variant="secondary">Áp dụng</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ),
    },
    {
      name: "Textarea kèm thanh công cụ",
      node: (
        <InputGroup className="w-80">
          <InputGroupTextarea placeholder="Viết bình luận..." rows={3} />
          <InputGroupAddon align="block-end">
            <InputGroupText>Hỗ trợ Markdown</InputGroupText>
            <InputGroupButton variant="default" className="ml-auto">
              Gửi
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ),
    },
  ],
};

const inputOtpSection: ShowcaseSection = {
  id: "input-otp",
  title: "Input OTP",
  description: "Nhập mã xác thực nhiều ô.",
  cases: [
    {
      name: "6 ô liền nhau",
      node: (
        <InputOTP maxLength={6}>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      ),
    },
    {
      name: "Chia nhóm có dấu ngăn",
      node: (
        <InputOTP maxLength={6}>
          <InputOTPGroup>
            {[0, 1, 2].map((index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            {[3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      ),
    },
    {
      name: "Disabled",
      node: (
        <InputOTP maxLength={4} disabled>
          <InputOTPGroup>
            {[0, 1, 2, 3].map((index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      ),
    },
  ],
};

export const formInputsSections: ShowcaseSection[] = [
  inputSection,
  textareaSection,
  labelSection,
  nativeSelectSection,
  inputGroupSection,
  inputOtpSection,
];
