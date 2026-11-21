import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "./Icons";
import "./PasswordInput.css";

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Accessible name for the reveal button, e.g. "Afficher le mot de passe". */
  showLabel?: string;
  /** Accessible name for the hide button, e.g. "Masquer le mot de passe". */
  hideLabel?: string;
}

/**
 * Password field with a show/hide toggle.
 *
 * The toggle is rendered *next to* the input rather than on top of it: Safari
 * draws its own password-manager button inside password fields, so an overlaid
 * eye icon would end up stacked on it and one of the two would be unusable.
 *
 * Visibility is local state only — it is never persisted.
 */
function PasswordInput({
  showLabel = "Afficher le mot de passe",
  hideLabel = "Masquer le mot de passe",
  className,
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="password-field">
      <input
        {...inputProps}
        id={inputProps.id ?? id}
        type={visible ? "text" : "password"}
        className={className ? `modern-input ${className}` : "modern-input"}
      />
      <button
        type="button"
        className="password-toggle-btn"
        aria-label={visible ? hideLabel : showLabel}
        aria-controls={inputProps.id ?? id}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

export default PasswordInput;
