import { notFound } from "next/navigation";
import {
  DOC_NAV,
  getAdjacentPages,
  getDocMarkdown,
  getDocPage,
  listDocSlugs,
} from "@/lib/docs";
import DocsShell from "../DocsShell";
import MarkdownArticle from "../MarkdownArticle";

export function generateStaticParams() {
  return listDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) return { title: "Not found" };
  return {
    title: `${page.title} — Palmprint Docs`,
    description: page.description,
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  const markdown = getDocMarkdown(slug);
  if (!page || !markdown) notFound();

  const adjacent = getAdjacentPages(slug);

  return (
    <DocsShell sections={DOC_NAV}>
      <MarkdownArticle
        title={page.title}
        description={page.description}
        markdown={markdown}
        slug={slug}
        adjacent={adjacent}
      />
    </DocsShell>
  );
}
