export type ItemStatus = "todo" | "done";

export interface Item {
  id: bigint;
  title: string;
  status: ItemStatus;
}
