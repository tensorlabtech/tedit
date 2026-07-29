import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const checkboxSection: ShowcaseSection = {
  id: "checkbox",
  title: "Checkbox",
  description: "Ô chọn nhiều, có cả trạng thái nửa chọn.",
  cases: [
    {
      name: "Trạng thái",
      node: (
        <>
          <Checkbox />
          <Checkbox defaultChecked />
          <Checkbox indeterminate defaultChecked />
          <Checkbox disabled />
          <Checkbox disabled defaultChecked />
        </>
      ),
    },
    {
      name: "Kèm nhãn",
      node: (
        <div className="flex items-center gap-2">
          <Checkbox id="demo-checkbox-terms" defaultChecked />
          <Label htmlFor="demo-checkbox-terms">Đồng ý với điều khoản</Label>
        </div>
      ),
    },
  ],
};

const radioGroupSection: ShowcaseSection = {
  id: "radio-group",
  title: "Radio Group",
  description: "Chọn một trong nhiều lựa chọn.",
  cases: [
    {
      name: "Dọc",
      node: (
        <RadioGroup defaultValue="standard" className="grid gap-3">
          {[
            { value: "standard", label: "Tiêu chuẩn" },
            { value: "fast", label: "Nhanh" },
            { value: "express", label: "Hoả tốc" },
          ].map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem
                value={option.value}
                id={`demo-radio-${option.value}`}
              />
              <Label htmlFor={`demo-radio-${option.value}`}>
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ),
    },
    {
      name: "Ngang + disabled",
      node: (
        <RadioGroup defaultValue="a" className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="a" id="demo-radio-a" />
            <Label htmlFor="demo-radio-a">Lựa chọn A</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="b" id="demo-radio-b" disabled />
            <Label htmlFor="demo-radio-b">Không khả dụng</Label>
          </div>
        </RadioGroup>
      ),
    },
  ],
};

const switchSection: ShowcaseSection = {
  id: "switch",
  title: "Switch",
  description: "Công tắc bật/tắt cho thiết lập tức thời.",
  cases: [
    {
      name: "Trạng thái",
      node: (
        <>
          <Switch />
          <Switch defaultChecked />
          <Switch disabled />
          <Switch disabled defaultChecked />
        </>
      ),
    },
    {
      name: "Kèm nhãn",
      node: (
        <div className="flex items-center gap-2">
          <Switch id="demo-switch-noti" defaultChecked />
          <Label htmlFor="demo-switch-noti">Nhận thông báo</Label>
        </div>
      ),
    },
  ],
};

const sliderSection: ShowcaseSection = {
  id: "slider",
  title: "Slider",
  description: "Chọn giá trị theo dải, hỗ trợ một hoặc hai điểm.",
  cases: [
    { name: "Một điểm", node: <Slider defaultValue={40} className="w-72" /> },
    {
      name: "Khoảng giá trị",
      node: <Slider defaultValue={[25, 75]} className="w-72" />,
    },
    {
      name: "Bước nhảy 10",
      node: <Slider defaultValue={30} step={10} className="w-72" />,
    },
    {
      name: "Disabled và dọc",
      node: (
        <div className="flex items-center gap-8">
          <Slider defaultValue={50} disabled className="w-56" />
          <Slider defaultValue={60} orientation="vertical" className="h-40" />
        </div>
      ),
    },
  ],
};

const fieldSection: ShowcaseSection = {
  id: "field",
  title: "Field",
  description: "Bố cục chuẩn cho một trường form: nhãn, mô tả, lỗi.",
  cases: [
    {
      name: "Dọc kèm mô tả",
      node: (
        <Field className="w-72">
          <FieldLabel htmlFor="demo-field-name">Tên dự án</FieldLabel>
          <Input id="demo-field-name" placeholder="Teddit" />
          <FieldDescription>
            Tên hiển thị trong danh sách dự án.
          </FieldDescription>
        </Field>
      ),
    },
    {
      name: "Trạng thái lỗi",
      node: (
        <Field className="w-72" data-invalid="true">
          <FieldLabel htmlFor="demo-field-email">Email</FieldLabel>
          <Input
            id="demo-field-email"
            aria-invalid
            defaultValue="sai-dinh-dang"
          />
          <FieldError>Email không hợp lệ.</FieldError>
        </Field>
      ),
    },
    {
      name: "Ngang với công tắc",
      node: (
        <Field orientation="horizontal" className="w-80">
          <FieldContent>
            <FieldTitle>Tự động lưu</FieldTitle>
            <FieldDescription>Lưu bản nháp mỗi 30 giây.</FieldDescription>
          </FieldContent>
          <Switch defaultChecked />
        </Field>
      ),
    },
    {
      name: "Nhóm trường trong fieldset",
      node: (
        <FieldSet className="w-80">
          <FieldLegend>Thông tin liên hệ</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="demo-field-phone">Số điện thoại</FieldLabel>
              <Input id="demo-field-phone" placeholder="09xx xxx xxx" />
            </Field>
            <FieldSeparator>hoặc</FieldSeparator>
            <Field>
              <FieldLabel htmlFor="demo-field-note">Ghi chú</FieldLabel>
              <Textarea id="demo-field-note" rows={3} />
            </Field>
          </FieldGroup>
        </FieldSet>
      ),
    },
  ],
};

export const formControlsSections: ShowcaseSection[] = [
  checkboxSection,
  radioGroupSection,
  switchSection,
  sliderSection,
  fieldSection,
];
