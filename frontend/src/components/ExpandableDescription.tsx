import { useRef } from "react";
import { useIsOverflowing } from "../hooks/useIsOverflowing";
import { useTranslation } from "../i18n";
import "./ExpandableDescription.css";

interface ExpandableDescriptionProps {
  description: string;
  descriptionClassName: string;
  expanded: boolean;
  onToggle: () => void;
}

export function ExpandableDescription({
  description,
  descriptionClassName,
  expanded,
  onToggle,
}: ExpandableDescriptionProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const isOverflowing = useIsOverflowing(ref, description, expanded);
  const { t } = useTranslation();

  if (!description) return null;

  return (
    <div className="description-wrapper">
      <p
        ref={ref}
        className={`${descriptionClassName}${expanded ? " expanded" : ""}`}
      >
        {description}
      </p>
      {(isOverflowing || expanded) && (
        <button
          type="button"
          className="see-more-btn"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? t("common.seeLess") : t("common.seeMore")}
        </button>
      )}
    </div>
  );
}

export default ExpandableDescription;
