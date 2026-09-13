import { useRef, useState } from "react";
import { UploadIcon } from "./Icons";
import { parseDishImportJson } from "../utils/validateDishImport";
import type {
  DishImportError,
  ValidatedDishImportItem,
} from "../types/dish";
import "./ImportDishesModal.css";

export type ImportOutcome = {
  imported: number;
  failed: number;
  errors: DishImportError[];
  offline: boolean;
  message?: string;
};

interface ImportDishesModalProps {
  onClose: () => void;
  onImport: (items: ValidatedDishImportItem[]) => Promise<ImportOutcome>;
}

type ParseState =
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      fileName: string;
      total: number;
      items: ValidatedDishImportItem[];
      errors: DishImportError[];
    };

function formatFieldErrors(errors: DishImportError): string {
  return errors.errors.map((e) => e.message).join(", ");
}

export function ImportDishesModal({
  onClose,
  onImport,
}: ImportDishesModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parse, setParse] = useState<ParseState>({ status: "empty" });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportOutcome | null>(null);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setParse({ status: "error", message: "Impossible de lire le fichier." });
      return;
    }

    const parsed = parseDishImportJson(text);
    if (!parsed.ok) {
      setParse({ status: "error", message: parsed.error });
      return;
    }
    setParse({
      status: "ready",
      fileName: file.name,
      total: parsed.total,
      items: parsed.items,
      errors: parsed.errors,
    });
  };

  const handleImport = async () => {
    if (parse.status !== "ready" || parse.items.length === 0) return;
    setImporting(true);
    try {
      const outcome = await onImport(parse.items);
      setResult(outcome);
    } catch {
      setResult({
        imported: 0,
        failed: parse.items.length,
        errors: [],
        offline: false,
      });
    } finally {
      setImporting(false);
    }
  };

  const clientErrors = parse.status === "ready" ? parse.errors : [];
  const backendErrors = result?.errors ?? [];
  const canImport =
    parse.status === "ready" && parse.items.length > 0 && !importing && !result;

  const handleBackdrop = () => {
    if (!importing) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div
        className="modal-card import-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title">Importer des plats</h3>

        {!result && (
          <>
            <p className="modal-text">
              Sélectionnez un fichier JSON contenant un tableau de plats. Chaque
              plat doit avoir un nom, un type (0 = entrée, 1 = plat, 2 =
              dessert) et au moins une saison (0 à 3).
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              className="import-file-input"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              hidden
            />

            <button
              type="button"
              className="import-picker"
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon size={22} />
              <span>
                {parse.status === "ready"
                  ? parse.fileName
                  : "Choisir un fichier JSON"}
              </span>
            </button>

            {parse.status === "error" && (
              <p className="import-error-message">{parse.message}</p>
            )}

            {parse.status === "ready" && (
              <>
                <p className="import-summary">
                  {parse.total} élément{parse.total > 1 ? "s" : ""} détecté
                  {parse.total > 1 ? "s" : ""} · {parse.items.length} valide
                  {parse.items.length > 1 ? "s" : ""} · {parse.errors.length} en
                  erreur
                </p>

                {clientErrors.length > 0 && (
                  <ul className="import-error-list">
                    {clientErrors.map((error) => (
                      <li key={error.index}>
                        <strong>
                          Élément {Number(error.index) + 1}
                          {error.name ? ` — ${error.name}` : ""}
                        </strong>
                        {": "}
                        {formatFieldErrors(error)}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}

        {result && (
          <>
            <p className="import-summary">
              {result.offline
                ? `${result.imported} plat(s) enregistré(s) localement, en attente de synchronisation.`
                : `${result.imported} plat(s) importé(s), ${result.failed} en échec.`}
            </p>

            {result.message && (
              <p className="import-error-message">{result.message}</p>
            )}

            {[...clientErrors, ...backendErrors].length > 0 && (
              <ul className="import-error-list">
                {[...clientErrors, ...backendErrors].map((error, i) => (
                  <li key={`${error.index}-${i}`}>
                    <strong>
                      Élément {Number(error.index) + 1}
                      {error.name ? ` — ${error.name}` : ""}
                    </strong>
                    {": "}
                    {formatFieldErrors(error)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="modal-actions">
          {result ? (
            <button className="btn btn-primary" onClick={onClose}>
              Fermer
            </button>
          ) : (
            <>
              <button
                className="btn btn-revert"
                onClick={onClose}
                disabled={importing}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!canImport}
              >
                {importing
                  ? "Import en cours…"
                  : parse.status === "ready"
                    ? `Importer ${parse.items.length} plat(s)`
                    : "Importer"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportDishesModal;
