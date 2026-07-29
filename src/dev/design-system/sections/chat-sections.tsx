import { FileTextIcon, ImageIcon, XIcon } from "lucide-react";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from "@/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const messageSection: ShowcaseSection = {
  id: "message",
  title: "Message",
  description: "Một lượt hội thoại: avatar, tiêu đề, nội dung và chân tin.",
  cases: [
    {
      name: "Hai chiều hội thoại",
      node: (
        <MessageGroup className="w-96">
          <Message>
            <MessageAvatar>
              <Avatar size="sm">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
            </MessageAvatar>
            <MessageContent>
              <MessageHeader>Trợ lý</MessageHeader>
              <Bubble>
                <BubbleContent>
                  Bạn muốn dựng video theo kịch bản nào?
                </BubbleContent>
              </Bubble>
            </MessageContent>
          </Message>
          <Message align="end">
            <MessageContent>
              <Bubble align="end" variant="secondary">
                <BubbleContent>Dùng kịch bản tuần trước nhé.</BubbleContent>
              </Bubble>
              <MessageFooter>Đã gửi 09:12</MessageFooter>
            </MessageContent>
          </Message>
        </MessageGroup>
      ),
    },
  ],
};

const bubbleSection: ShowcaseSection = {
  id: "bubble",
  title: "Bubble",
  description: "Bong bóng chat với đủ variant và biểu cảm.",
  cases: [
    {
      name: "Variant",
      node: (
        <div className="grid w-96 gap-2">
          {(
            [
              "default",
              "secondary",
              "muted",
              "tinted",
              "outline",
              "ghost",
              "destructive",
            ] as const
          ).map((variant) => (
            <Bubble key={variant} variant={variant}>
              <BubbleContent>variant = {variant}</BubbleContent>
            </Bubble>
          ))}
        </div>
      ),
    },
    {
      name: "Căn phải và nhóm bong bóng",
      node: (
        <BubbleGroup className="w-96">
          <Bubble align="end" variant="secondary">
            <BubbleContent>Tin nhắn thứ nhất</BubbleContent>
          </Bubble>
          <Bubble align="end" variant="secondary">
            <BubbleContent>Tin nhắn thứ hai</BubbleContent>
          </Bubble>
        </BubbleGroup>
      ),
    },
    {
      name: "Có biểu cảm",
      node: (
        <Bubble className="w-96">
          <BubbleContent>Bản dựng đã xong, xem thử nhé.</BubbleContent>
          <BubbleReactions>👍 2</BubbleReactions>
        </Bubble>
      ),
    },
  ],
};

const attachmentSection: ShowcaseSection = {
  id: "attachment",
  title: "Attachment",
  description: "Thẻ tệp đính kèm, có trạng thái tải lên và lỗi.",
  cases: [
    {
      name: "Trạng thái",
      node: (
        <AttachmentGroup className="grid w-96 gap-2">
          <Attachment state="done">
            <AttachmentMedia>
              <FileTextIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>kich-ban.pdf</AttachmentTitle>
              <AttachmentDescription>240 KB</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction aria-label="Gỡ tệp">
                <XIcon />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
          <Attachment state="uploading">
            <AttachmentMedia>
              <Spinner />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>video-goc.mp4</AttachmentTitle>
              <AttachmentDescription>Đang tải lên 45%</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment state="error">
            <AttachmentMedia>
              <ImageIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>anh-bia.png</AttachmentTitle>
              <AttachmentDescription>Tải lên thất bại</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </AttachmentGroup>
      ),
    },
    {
      name: "Size và hướng dọc",
      node: (
        <div className="flex items-start gap-3">
          <Attachment size="sm">
            <AttachmentMedia>
              <FileTextIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>size = sm</AttachmentTitle>
            </AttachmentContent>
          </Attachment>
          <Attachment size="xs">
            <AttachmentMedia>
              <FileTextIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>size = xs</AttachmentTitle>
            </AttachmentContent>
          </Attachment>
          <Attachment orientation="vertical">
            <AttachmentMedia>
              <ImageIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>Dọc</AttachmentTitle>
            </AttachmentContent>
          </Attachment>
        </div>
      ),
    },
  ],
};

const messageScrollerSection: ShowcaseSection = {
  id: "message-scroller",
  title: "Message Scroller",
  description: "Vùng cuộn hội thoại tự bám đáy, kèm nút nhảy xuống cuối.",
  cases: [
    {
      name: "Danh sách tin nhắn dài",
      node: (
        <MessageScrollerProvider>
          <MessageScroller className="h-64 w-96 rounded-xl border border-border bg-card">
            <MessageScrollerViewport className="p-3">
              <MessageScrollerContent>
                {Array.from({ length: 15 }, (_, index) => (
                  <MessageScrollerItem key={index}>
                    <Message align={index % 2 === 0 ? "start" : "end"}>
                      <MessageContent>
                        <Bubble
                          align={index % 2 === 0 ? "start" : "end"}
                          variant={index % 2 === 0 ? "default" : "secondary"}
                        >
                          <BubbleContent>Tin nhắn số {index + 1}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      ),
    },
  ],
};

export const chatSections: ShowcaseSection[] = [
  messageSection,
  bubbleSection,
  attachmentSection,
  messageScrollerSection,
];
