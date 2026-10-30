"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { ChoiceChips } from "@/components/ChoiceChips";
import { submitInquiry } from "@/lib/inquiry-actions";
import { INQUIRY_CATEGORIES, INQUIRY_LIMITS, findInquiryTopic, type InquiryCategory, type InquiryResult } from "@/lib/inquiry-kinds";

type StoreOption = { id: number; name: string; region: string };
type CategoryKey = (typeof INQUIRY_CATEGORIES)[number]["key"];

type Props = { stores: StoreOption[]; initialCategory: CategoryKey | null; initialStoreId: number | null };

// '의견·요청 보내기' 서식: 종류 → 보기 → 그 보기에 필요한 칸만 나타난다.
// 로그인 없이 보낼 수 있고, 연락처는 보기에 따라 꼭 받거나(게시 멈추기) 안 받는다(모임·책 정보 오류).
export function ContactForm({ stores, initialCategory, initialStoreId }: Props) {
  const [categoryKey, setCategoryKey] = useState<CategoryKey | null>(initialCategory);
  const category = (INQUIRY_CATEGORIES as readonly InquiryCategory[]).find((c) => c.key === categoryKey) ?? null;
  // 보기가 하나뿐인 종류(새 책방 알려주기)는 따로 고르지 않는다
  const [pickedTopic, setPickedTopic] = useState<string | null>(null);
  const topicKey = category && category.topics.length === 1 ? category.topics[0].key : pickedTopic;
  const topic = categoryKey && topicKey ? (findInquiryTopic(categoryKey, topicKey)?.topic ?? null) : null;

  const [storeId, setStoreId] = useState<string>(initialStoreId ? String(initialStoreId) : "");
  const [storeName, setStoreName] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [result, setResult] = useState<InquiryResult | null>(null);
  // 빈 칸이 있는데 보내기를 눌렀는지. 누른 뒤부터 비어 있는 꼭 적을 칸을 빨간 테두리로 보여 준다(채우면 바로 사라짐)
  const [showMissing, setShowMissing] = useState(false);
  const [pending, startTransition] = useTransition();
  const honeypotRef = useRef<HTMLInputElement>(null);

  // 책방 고르기 칸: 지역별로 묶는다
  const storeGroups = useMemo(() => {
    const groups = new Map<string, StoreOption[]>();
    for (const s of stores) groups.set(s.region, [...(groups.get(s.region) ?? []), s]);
    return [...groups.entries()];
  }, [stores]);

  // 비어 있는 꼭 적을 칸(화면 위에서부터 차례로)
  const missingFields = topic
    ? [
        topic.store === "pick" && !storeId && "contact-store",
        topic.store === "name" && !storeName.trim() && "contact-store-name",
        topic.message === "required" && !message.trim() && "contact-message",
        topic.contact === "required" && !contact.trim() && "contact-contact",
      ].filter((id): id is string => Boolean(id))
    : [];
  const missing = !topic || missingFields.length > 0;
  const isMissing = (id: string) => showMissing && missingFields.includes(id);

  const chooseCategory = (key: CategoryKey) => {
    setCategoryKey(key);
    setPickedTopic(null);
    setResult(null);
    setShowMissing(false);
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryKey || !topic || pending) return;
    if (missingFields.length > 0) {
      // 빈 칸 중 맨 위 칸으로 커서를 옮긴다
      setShowMissing(true);
      document.getElementById(missingFields[0])?.focus();
      return;
    }
    startTransition(async () => {
      try {
        setResult(
          await submitInquiry({
            category: categoryKey,
            topic: topic.key,
            storeId: topic.store === "pick" ? Number(storeId) : null,
            storeName,
            link,
            message,
            contact,
            website: honeypotRef.current?.value,
          }),
        );
      } catch {
        setResult({ ok: false, reason: "failed" });
      }
    });
  };

  if (result?.ok) {
    const willReply = topic?.contact !== "none" && contact.trim();
    const sentStore = topic?.store === "pick" ? stores.find((s) => String(s.id) === storeId) : null;
    return (
      <div role="status" className="mt-6 rounded-md bg-sub px-4 py-5">
        <p className="text-t1 text-ink">보냈어요</p>
        <p className="mt-2 text-b2 text-ink-2">
          {willReply ? "운영자가 읽고 적어 주신 연락처로 답장드릴게요." : "운영자가 읽고 확인할게요. 알려주셔서 고마워요."}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {sentStore && (
            <Link
              href={`/s/${sentStore.id}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm bg-navy px-4 text-l1 font-semibold text-page hover:bg-navy-hover"
            >
              {sentStore.name} 화면으로
            </Link>
          )}
          <Link
            href="/"
            className={
              sentStore
                ? "inline-flex min-h-11 flex-1 items-center justify-center rounded-sm border border-border bg-card px-4 text-l1 font-semibold text-ink-2 hover:bg-page"
                : "inline-flex min-h-11 flex-1 items-center justify-center rounded-sm bg-navy px-4 text-l1 font-semibold text-page hover:bg-navy-hover"
            }
          >
            모임 둘러보기
          </Link>
        </div>
      </div>
    );
  }

  return (
    // 브라우저 기본 말풍선 대신 빨간 테두리와 안내 문구로 알린다(noValidate)
    <form onSubmit={send} noValidate className="mt-6">
      <ChoiceChips name="category" legend="어떤 내용인가요?" options={INQUIRY_CATEGORIES} value={categoryKey} onChange={chooseCategory} />

      {category && category.topics.length > 1 && (
        <ChoiceChips
          key={category.key}
          name="topic"
          legend={category.topicLegend ?? "자세히 골라 주세요"}
          options={category.topics}
          value={pickedTopic}
          onChange={(k) => {
            setPickedTopic(k);
            setResult(null);
            setShowMissing(false);
          }}
          className="mt-6"
        />
      )}

      {topic && (
        <div className="mt-6 space-y-5 border-t border-border pt-5">
          {topic.hint && <p className="rounded-xs bg-info-surface px-3 py-2.5 text-l2 font-normal leading-normal text-info">{topic.hint}</p>}

          {topic.store === "pick" && (
            <Field id="contact-store" label="어느 책방인가요?" missing={isMissing("contact-store")}>
              <select
                id="contact-store"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                required
                {...invalidProps(isMissing("contact-store"), "contact-store")}
                className={`${inputClass(isMissing("contact-store"))} ${storeId ? "" : "text-ink-3"}`}
              >
                <option value="">책방을 골라 주세요</option>
                {storeGroups.map(([region, list]) => (
                  <optgroup key={region} label={region}>
                    {list.map((s) => (
                      <option key={s.id} value={s.id} className="text-ink">
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          )}

          {topic.store === "name" && (
            <>
              <Field id="contact-store-name" label="책방 이름" hint="운영하시는 책방이어도 좋아요." missing={isMissing("contact-store-name")}>
                <input
                  id="contact-store-name"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  maxLength={INQUIRY_LIMITS.storeName}
                  required
                  placeholder="예: 부엉이책방 (서울 마포구)"
                  {...invalidProps(isMissing("contact-store-name"), "contact-store-name")}
                  className={inputClass(isMissing("contact-store-name"))}
                />
              </Field>
              <Field id="contact-link" label="인스타그램이나 모임 안내 주소" optional>
                <input
                  id="contact-link"
                  type="text"
                  inputMode="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  maxLength={INQUIRY_LIMITS.link}
                  placeholder="예: instagram.com/owl_books"
                  className={inputClass(false)}
                />
              </Field>
            </>
          )}

          <Field id="contact-message" label="자세한 내용" optional={topic.message === "optional"} missing={isMissing("contact-message")}>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={INQUIRY_LIMITS.message}
              required={topic.message === "required"}
              rows={4}
              placeholder={topic.placeholder}
              {...invalidProps(isMissing("contact-message"), "contact-message")}
              className={`${inputClass(isMissing("contact-message"))} resize-none py-2.5`}
            />
          </Field>

          {topic.contact !== "none" && (
            <Field
              id="contact-contact"
              label="답장 받을 연락처"
              optional={topic.contact === "optional"}
              hint="답장과 운영자 확인에만 쓰고, 처리를 마친 뒤 3개월이 지나면 지워요."
              missing={isMissing("contact-contact")}
            >
              <input
                id="contact-contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={INQUIRY_LIMITS.contact}
                required={topic.contact === "required"}
                autoComplete="email"
                placeholder="이메일, 전화번호, 인스타 아이디 중 편한 것"
                {...invalidProps(isMissing("contact-contact"), "contact-contact")}
                className={inputClass(isMissing("contact-contact"))}
              />
            </Field>
          )}

          {/* 사람 눈에는 보이지 않는 칸(자동 프로그램 걸러내기용) */}
          <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

          {result && !result.ok && (
            <p role="alert" className="text-l2 text-error">
              {result.reason === "too_many"
                ? "짧은 시간에 여러 번 보내셨어요. 잠시 뒤에 다시 보내 주세요."
                : result.reason === "invalid"
                  ? "빠진 칸이 있어요. 꼭 적어야 하는 칸을 확인해 주세요."
                  : "보내지 못했어요. 다시 눌러 주세요."}
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={pending}
              // 빈 칸이 있으면 회색으로 두되 누를 수는 있다(누르면 빈 칸을 알려 준다)
              className={`min-h-11 w-full rounded-sm py-3 text-l1 font-semibold disabled:bg-fill disabled:text-ink-3 ${missing ? "bg-fill text-ink-3" : "bg-navy text-page hover:bg-navy-hover"}`}
            >
              {pending ? "보내는 중…" : "보내기"}
            </button>
            <p className="mt-2 text-l2 font-normal text-ink-3">내용에는 다른 사람의 이름·연락처 같은 개인정보를 적지 말아 주세요.</p>
          </div>
        </div>
      )}
    </form>
  );
}

// 빈 칸으로 표시된 칸은 테두리를 디자인 시스템 오류 색(error)으로, 커서가 들어가도 빨간색 그대로
const inputClass = (invalid: boolean) =>
  `mt-1.5 block min-h-11 w-full rounded-xs border bg-card px-3 text-b2 text-ink placeholder:text-ink-3 focus:outline-2 ${
    invalid ? "border-error focus:border-error focus:outline-error" : "border-border-control focus:border-navy focus:outline-navy"
  }`;

// 화면 읽기 프로그램에도 '비어 있음'과 안내 문구를 연결한다
const invalidProps = (invalid: boolean, id: string) =>
  invalid ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

function Field({ id, label, optional, hint, missing, children }: { id: string; label: string; optional?: boolean; hint?: string; missing?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-l1 font-semibold text-ink">
        {label} {optional !== undefined && <span className="font-normal text-ink-3">{optional ? "(안 써도 돼요)" : "(꼭 적어 주세요)"}</span>}
      </label>
      {children}
      {missing && (
        <p id={`${id}-error`} className="mt-1 text-l2 font-normal text-error">
          이 칸을 채워 주세요.
        </p>
      )}
      {hint && <p className="mt-1 text-l2 font-normal text-ink-3">{hint}</p>}
    </div>
  );
}
