export function WarningBanner() {
  return (
    <div className="banner" role="status">
      ⚠ <strong>Local vault only. Do not expose to network.</strong> DRISHTI-Vault runs on
      127.0.0.1 and is not designed for remote or multi-user access.
    </div>
  );
}
