import { ItemStatus as BackendItemStatus } from "@/backend";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateItem,
  useDeleteItem,
  useItems,
  useUpdateItem,
} from "@/hooks/useItems";
import type { Item } from "@/types";
import { useState } from "react";

export default function ItemsPage() {
  const { data: items = [], isLoading } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    createItem.mutate(trimmed, { onSuccess: () => setNewTitle("") });
  };

  const handleToggle = (item: Item) => {
    const nextStatus =
      item.status === "done" ? BackendItemStatus.todo : BackendItemStatus.done;
    updateItem.mutate({ id: item.id, title: item.title, status: nextStatus });
  };

  const handleEditSave = (item: Item) => {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    updateItem.mutate(
      {
        id: item.id,
        title: trimmed,
        status:
          item.status === "done"
            ? BackendItemStatus.done
            : BackendItemStatus.todo,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditTitle("");
        },
      },
    );
  };

  return (
    <section data-ocid="items.page">
      {/* Add form */}
      <div className="flex gap-2 mb-6" data-ocid="items.add_form">
        <Input
          data-ocid="items.input"
          placeholder="New task description..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 font-mono bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
        />
        <Button
          type="button"
          data-ocid="items.add_button"
          onClick={handleAdd}
          disabled={createItem.isPending || !newTitle.trim()}
          className="font-mono font-bold tracking-wide bg-primary text-primary-foreground hover:bg-primary/85 transition-colors duration-200"
        >
          Add
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div data-ocid="items.loading_state" className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-sm bg-card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div
          data-ocid="items.empty_state"
          className="border border-border rounded-sm p-12 text-center"
        >
          <p className="font-mono text-sm text-muted-foreground mb-1">
            NO TASKS YET
          </p>
          <p className="font-mono text-xs text-muted-foreground/60">
            Add your first task above to get started.
          </p>
        </div>
      )}

      {/* Items list */}
      {!isLoading && items.length > 0 && (
        <ul data-ocid="items.list" className="space-y-px">
          {items.map((item, index) => (
            <li
              key={String(item.id)}
              data-ocid={`items.item.${index + 1}`}
              className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-sm group"
            >
              <Checkbox
                data-ocid={`items.checkbox.${index + 1}`}
                checked={item.status === "done"}
                onCheckedChange={() => handleToggle(item)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                aria-label={`Mark "${item.title}" as ${item.status === "done" ? "todo" : "done"}`}
              />

              <div className="flex-1 min-w-0">
                {editingId === item.id ? (
                  <Input
                    data-ocid={`items.edit_input.${index + 1}`}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEditSave(item);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditTitle("");
                      }
                    }}
                    autoFocus
                    className="h-7 font-mono text-sm bg-background border-primary text-foreground focus-visible:ring-primary"
                  />
                ) : (
                  <>
                    <p
                      className={`font-mono text-sm truncate ${
                        item.status === "done"
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground/60 capitalize">
                      {item.status === "done" ? "Done" : "To Do"}
                    </p>
                  </>
                )}
              </div>

              <div className="flex gap-1 shrink-0">
                {editingId === item.id ? (
                  <Button
                    type="button"
                    data-ocid={`items.save_button.${index + 1}`}
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditSave(item)}
                    className="font-mono text-xs h-7 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                  >
                    Save
                  </Button>
                ) : (
                  <Button
                    type="button"
                    data-ocid={`items.edit_button.${index + 1}`}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditTitle(item.title);
                    }}
                    className="font-mono text-xs h-7 border-border text-foreground hover:border-primary hover:text-primary transition-colors duration-200"
                  >
                    Edit
                  </Button>
                )}
                <Button
                  type="button"
                  data-ocid={`items.delete_button.${index + 1}`}
                  variant="outline"
                  size="sm"
                  onClick={() => deleteItem.mutate(item.id)}
                  disabled={deleteItem.isPending}
                  className="font-mono text-xs h-7 border-border text-foreground hover:border-destructive hover:text-destructive transition-colors duration-200"
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
