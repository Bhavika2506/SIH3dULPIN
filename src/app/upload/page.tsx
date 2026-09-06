import FileUploader from "@/src/components/FileUploader";

export default function UploadPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "40px 25px",
      }}
    >

      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >

        <div
          style={{
            marginBottom: "25px",
          }}
        >

          <a
            href="/"
            style={{
              fontSize: "12px",
              color: "#2563eb",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Back to Dashboard
          </a>

          <h1
            style={{
              margin:
                "15px 0 5px",
              fontSize: "28px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Import 2D Property Data
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            Upload a cadastral or architectural
            floor plan to generate a 3D property
            structure and cadastral graph.
          </p>

        </div>

        <FileUploader />

      </div>

    </main>
  );
}