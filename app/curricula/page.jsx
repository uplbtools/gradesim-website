// app/curricula/page.jsx

"use client";

import { useState, useEffect } from "react";
import styles from "./curricula.module.css";
import CURRICULA_DATA from "./data";

// Mapping of curriculum PNG slugs to extension program codes
// so we can pull the course list from curriculum.js data
const SLUG_TO_PROGRAM = {
  "BS-Chemistry": "BSCHEM",
  "BS-Biology": "BSBIO",
  "BS-Applied-Mathematics": "BSAPMATH",
  "BS-Applied-Physics": "BSAPPHY",
  "BS-Mathematics": "BSMATH",
  "BS-Statistics": "BSSTAT",
  "BA-Communication-Arts": "BACOMM",
  "BA-Philosophy": "BAPHILO",
  "BA-Sociology": "BASOCIO",
  "BS-Agriculture": "BSAGRI",
  "BS-Agricultural-Biotechnology": "BSABIO",
  "BS-Food-Science-and-Technology": "BSFST",
  "BS-Agricultural-and-Applied-Economics": "BSAAE",
  "BS-Agribusiness-Management-Entrepreneurship": "BSABME",
  "BS-Economics": "BSECON",
  "BS-Chemical-Engineering": "BSCHE",
  "BS-Civil-Engineering": "BSCE",
  "BS-Electrical-Engineering": "BSEE",
  "BS-Industrial-Engineering": "BSIE",
  "BS-Mechanical-Engineering": "BSME",
  "BS-Forestry": "BSFOR",
  "BS-Human-Ecology": "BSHDFS",
  "BS-Nutrition": "BSNUTRI",
  "Doctor-of-Veterinary-Medicine": "DVM",
  "BS-Development-Communication": "BSDC",
  "BS-Agricultural-Chemistry": "BSACHEM",
};

function ProgramModal({ program, college, onClose }) {
  const [tab, setTab] = useState("image");

  // Close on escape
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const imageUrls = [];
  for (let i = 1; i <= program.pages; i++) {
    imageUrls.push(`/curricula/${college.collegeCode}/${program.slug}-${i}.png`);
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>{program.name}</div>
            <div className={styles.modalCollege}>{college.college}</div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className={styles.modalTabs}>
          <button
            className={`${styles.modalTab} ${tab === "image" ? styles.modalTabActive : ""}`}
            onClick={() => setTab("image")}
          >
            Curriculum Checklist
          </button>
          <button
            className={`${styles.modalTab} ${tab === "graph" ? styles.modalTabActive : ""}`}
            onClick={() => setTab("graph")}
          >
            Course Graph
          </button>
        </div>

        {tab === "image" && (
          <div className={styles.imageContainer}>
            {imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${program.name} curriculum page ${i + 1}`}
                className={styles.curriculumImage}
                width="800"
                height="600"
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
        )}

        {tab === "graph" && <CourseGraph slug={program.slug} />}
      </div>
    </div>
  );
}

function CourseGraph({ slug }) {
  // Group courses by year based on comments in curriculum.js data
  // Since we don't have the actual JS object at runtime (it's an extension file),
  // we render a visual representation based on the course code structure
  const programCode = SLUG_TO_PROGRAM[slug];

  if (!programCode) {
    return (
      <div className={styles.noGraphData}>
        Course graph data not yet available for this program.
        <br />
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          Contribute the curriculum data on GitHub!
        </span>
      </div>
    );
  }

  // We'll render a placeholder that shows the program is supported
  // The actual graph would need the curriculum.js data imported
  return (
    <div className={styles.graphContainer}>
      <div className={styles.noGraphData}>
        <strong>{programCode}</strong> is supported in the GradeSim extension.
        <br />
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          Install the extension to see your personalized course graph with GWA simulation.
        </span>
      </div>
    </div>
  );
}

export default function CurriculaPage() {
  const [selected, setSelected] = useState(null);

  return (
    <div className={styles.curricula}>
      <div className="container">
        <div className={styles.header}>
          <a href="/" className={styles.backLink}>
            ← Back to home
          </a>
          <h1 className={styles.title}>UPLB Curricula</h1>
          <p className={styles.subtitle}>
            Official curriculum checklists for undergraduate degree programs at
            UPLB. Click a program to view its curriculum.
          </p>
        </div>

        {CURRICULA_DATA.map((college, ci) => (
          <div key={ci} className={styles.collegeSection}>
            <h2 className={styles.collegeName}>{college.college}</h2>
            <div className={styles.programsGrid}>
              {college.programs.map((program, pi) => (
                <div
                  key={pi}
                  className={`card ${styles.programCard}`}
                  onClick={() => setSelected({ program, college })}
                >
                  <span className={styles.programName}>{program.name}</span>
                  <span className={styles.programPages}>
                    {program.pages} pg{program.pages > 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <ProgramModal
          program={selected.program}
          college={selected.college}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
