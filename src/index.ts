import { Knex } from "knex";

export type Connection = Knex | Knex.Transaction;

export interface ConnectionOpts {
  conn: Connection;
}

export * from "./row";
