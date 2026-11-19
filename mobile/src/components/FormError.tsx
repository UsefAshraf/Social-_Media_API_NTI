import { Banner } from './Banner';

interface FormErrorProps {
  message?: string | null;
}

/** Form-level (server / network) error banner. Renders nothing without a message. */
export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return <Banner tone="error" message={message} testID="form-error" />;
}
