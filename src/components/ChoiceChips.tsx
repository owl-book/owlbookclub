// 동그란 선택 버튼 묶음(하나만 고르기). 정보 오류 신고 창과 '의견·요청 보내기'가 함께 쓴다.
// 실제로는 라디오 버튼이라 키보드 화살표로 옮겨 다닐 수 있다.
type Props<K extends string> = {
  name: string;
  legend: string;
  legendHidden?: boolean;
  options: readonly { key: K; label: string }[];
  value: K | null;
  onChange: (key: K) => void;
  className?: string;
};

export function ChoiceChips<K extends string>({ name, legend, legendHidden, options, value, onChange, className }: Props<K>) {
  return (
    <fieldset className={className}>
      <legend className={legendHidden ? "sr-only" : "text-l1 font-semibold text-ink"}>{legend}</legend>
      <div className={`flex flex-wrap gap-2 ${legendHidden ? "" : "mt-2"}`}>
        {options.map((o) => (
          <label
            key={o.key}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border-card bg-card px-4 text-l1 text-ink-2 hover:bg-sub has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy"
          >
            <input type="radio" name={name} value={o.key} checked={value === o.key} onChange={() => onChange(o.key)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
