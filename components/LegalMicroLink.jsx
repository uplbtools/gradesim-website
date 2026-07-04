import Link from "next/link";
import styles from "../app/legal.module.css";

export default function LegalMicroLink({
  href,
  children,
  subtle = false,
  className = "",
}) {
  const linkClass = subtle
    ? `${styles.legalMicroLink} ${styles["legalMicroLink--subtle"]}`
    : styles.legalMicroLink;

  return (
    <Link href={href} className={`${linkClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}
