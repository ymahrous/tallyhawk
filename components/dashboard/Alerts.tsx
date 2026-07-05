interface AlertProps {
  message: string;
  onDismiss: () => void;
}

function AlertIcon() {
  return (
    <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

export function UploadError({ message, onDismiss }: AlertProps) {
  if (!message) return null;
  return (
    <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
      <AlertIcon />
      <p className="text-sm text-red-500">{message}</p>
      <button onClick={onDismiss} className="ml-auto text-red-400 hover:text-red-300" aria-label="Dismiss error">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

export function DeleteError({ message, onDismiss }: AlertProps) {
  if (!message) return null;
  return (
    <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
      <AlertIcon />
      <p className="text-sm text-red-500">{message}</p>
      <button onClick={onDismiss} className="ml-auto text-red-400 hover:text-red-300" aria-label="Dismiss error">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}