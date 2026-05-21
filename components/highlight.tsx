export default function SearchHighlight({
  text,
  search,
}: {
  text: string;
  search?: string;
}) {
  if (!search || search.trim() === "") return <>{text}</>;

  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");//検索語に正規表現の特殊文字が含まれている場合に備えて、エスケープ処理を行います。これにより、検索語がそのままの文字列として扱われるようになります。

  const regex = new RegExp(`(${escapedSearch})`, "gi");//テキストを、検索語を含む部分とそれ以外の部分に分割します。正規表現のキャプチャグループを利用して、検索語を含む部分も結果に残るようにしています。
  const parts = text.split(regex);//テキストを、検索語を含む部分とそれ以外の部分に分割します。正規表現のキャプチャグループを利用して、検索語を含む部分も結果に残るようにしています。

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <strong
            key={i}
            className="bg-yellow-200 text-black px-0.5 rounded"
          >
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}