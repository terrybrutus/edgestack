import List "mo:core/List";
import ItemsApi "mixins/items-api";
import Types "types/items";

actor {
  let items : List.List<Types.Item>;
  let state : { var nextId : Nat };

  include ItemsApi(items, state);
};

