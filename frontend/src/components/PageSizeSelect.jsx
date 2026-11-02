const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function PageSizeSelect({ value, onChange, disabled = false }) {
  return (
    <label className="office-page-size">
      Rows
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
