import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Item {
    id: bigint;
    status: ItemStatus;
    title: string;
}
export enum ItemStatus {
    done = "done",
    todo = "todo"
}
export interface backendInterface {
    createItem(title: string): Promise<bigint>;
    deleteItem(id: bigint): Promise<boolean>;
    getItems(): Promise<Array<Item>>;
    updateItem(id: bigint, title: string, status: ItemStatus): Promise<boolean>;
}
