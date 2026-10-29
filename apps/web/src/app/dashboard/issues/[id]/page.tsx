import IssueDetail from "../../../../components/issue-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IssueDetail id={id} />;
}
