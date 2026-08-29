import { describe, expect, test } from "bun:test";
import { printDocsHuman, printJsonSuccess } from "../../src/lib/format";

const docs = {
  slug: "resend",
  docsUrl: "https://resend.com/docs",
  query: "how do I send attachments",
  results: [
    {
      url: "https://resend.com/docs/send-with-attachments",
      title: "Attachments",
      description: "Send emails with file attachments.",
      content: "# Attachments\nPass an attachments array.",
    },
  ],
};

describe("docs formatting", () => {
  test("includes results in JSON and human output", () => {
    const value = JSON.parse(
      printJsonSuccess({
        command: "docs",
        query: "resend how do I send attachments",
        data: docs,
        meta: { count: 1, total: 1 },
      }),
    );
    expect(value.data.results).toHaveLength(1);
    expect(printDocsHuman(docs, false)).toContain("Attachments");
    expect(printDocsHuman(docs, false)).toContain("https://resend.com/docs/send-with-attachments");
  });

  test("human output does not truncate docs content", () => {
    const longContent = "A".repeat(300);
    const longDescription = "B".repeat(200);
    const output = printDocsHuman(
      {
        ...docs,
        results: [
          {
            description: longDescription,
            content: `# Heading\n${longContent}`,
            url: docs.results[0]!.url,
            title: docs.results[0]!.title,
          },
        ],
      },
      false,
    );
    expect(output).toContain(longDescription);
    expect(output).toContain(longContent);
    expect(output).not.toContain("…");
    expect(output).toContain("     # Heading");
  });
});
