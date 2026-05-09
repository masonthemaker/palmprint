package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	palmprint "github.com/palmprint/palmprint-go"
)

func main() {
	secret := os.Getenv("PALMPRINT_SECRET")
	if secret == "" {
		secret = "dev-only-palmprint-secret-32-chars"
	}

	sdk, err := palmprint.New(palmprint.Options{Secret: secret})
	if err != nil {
		log.Fatal(err)
	}

	handlers := palmprint.NewHTTPHandlers(sdk)
	http.HandleFunc("/api/palmprint/challenge", handlers.Challenge)
	http.HandleFunc("/api/palmprint/redeem", handlers.Redeem)

	http.Handle("/api/protected", handlers.RequirePalmprint(
		palmprint.LevelMedium,
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, _ := palmprint.SessionFromContext(r.Context())
			fmt.Fprintf(w, "verified session for challenge %s\n", session.ChallengeNonce)
		}),
	))

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, pageHTML)
	})

	log.Println("Palmprint Go test page: http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

const pageHTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Palmprint Go SDK test page</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 44rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5; }
      button { background: #10b981; color: #02130c; border: 0; border-radius: 999px; padding: .75rem 1rem; font-weight: 700; cursor: pointer; }
      pre { background: #18181b; color: #d4d4d8; padding: 1rem; border-radius: .75rem; overflow: auto; }
    </style>
  </head>
  <body>
    <h1>Palmprint Go SDK test page</h1>
    <p>This page hits the Go <code>/challenge</code> route. In a real app, the Palmprint browser widget would produce the client token and redeem it through <code>/redeem</code>.</p>
    <button id="challenge">Issue challenge</button>
    <pre id="out">Waiting...</pre>
    <script>
      document.querySelector("#challenge").addEventListener("click", async () => {
        const res = await fetch("/api/palmprint/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ required_level: "medium" })
        });
        document.querySelector("#out").textContent = JSON.stringify(await res.json(), null, 2);
      });
    </script>
  </body>
</html>`
