import Knex, { QueryBuilder } from "knex";
import { Connection, ConnectionOpts } from ".";

type RowValue = unknown | number | boolean | string | Date | Knex.Raw;

type IdType = number | string;

type QueryFunction = (this: QueryBuilder) => QueryBuilder | void;

interface SelectOpts extends ConnectionOpts {
  tableName: string;
  where?: QueryFunction;
  includeDeleted?: boolean;
  includeDeletedCol?: string;
  before?: (query: QueryBuilder) => void;
}

export const DEFAULT_PAGINATION_LIMIT = 20;

export const ID_COL = "id";

export const TIME_CREATED_COL = "time_created";

export const TIME_UPDATED_COL = "time_updated";

export const TIME_DELETED_COL = "time_deleted";

export interface RowData {
  [key: string]: RowValue;
}

interface RowConstructorOpts extends ConnectionOpts {
  tableName: string;
  rowData: RowData;
  primaryCols?: string[];
  idCol?: string;
  timeCreatedCol?: string;
  timeUpdatedCol?: string;
  timeDeletedCol?: string;
}

export class Row<T extends IdType = number> {
  private readonly initialConn: Connection;
  private readonly primaryCols: string[];
  private readonly tableName: string;
  private readonly rowData: RowData;
  private readonly idCol: string;
  private readonly timeCreatedCol: string;
  private readonly timeUpdatedCol: string;
  private readonly timeDeletedCol: string;

  private conn: Connection;

  constructor(opts: RowConstructorOpts) {
    const {
      conn,
      tableName,
      rowData,
      idCol = ID_COL,
      timeCreatedCol = TIME_CREATED_COL,
      timeUpdatedCol = TIME_UPDATED_COL,
      timeDeletedCol = TIME_DELETED_COL,
      primaryCols = [idCol],
    } = opts;

    this.initialConn = conn;
    this.primaryCols = primaryCols;
    this.tableName = tableName;
    this.rowData = rowData;
    this.conn = conn;
    this.idCol = idCol;
    this.timeCreatedCol = timeCreatedCol;
    this.timeUpdatedCol = timeUpdatedCol;
    this.timeDeletedCol = timeDeletedCol;
  }

  get connection(): Connection {
    return this.conn;
  }

  set connection(value: Connection) {
    this.conn = value || this.initialConn;
  }

  isColumn(col: string): boolean {
    return typeof this.rowData[col] !== "undefined";
  }

  getColumn<T extends RowValue>(col: string): T {
    if (!this.isColumn(col)) {
      throw new Error(
        `Column '${col}' does not exist for table ${this.tableName}`
      );
    }

    return this.rowData[col] as T;
  }

  get id(): T {
    return this.getColumn<T>(this.idCol);
  }

  get timeCreated(): Date {
    return this.getColumn<Date>(this.timeCreatedCol);
  }

  get timeUpdated(): Date {
    return this.getColumn<Date>(this.timeUpdatedCol);
  }

  get timeDeleted(): Date {
    return this.getColumn<Date>(this.timeDeletedCol);
  }

  get primaryKey(): RowData {
    const key: RowData = {};

    for (const col of this.primaryCols) {
      key[col] = this.getColumn(col);
    }

    return key;
  }

  get query(): QueryBuilder {
    return this.connection(this.tableName).where(this.primaryKey);
  }

  get isDeleted(): boolean {
    return Boolean(this.timeDeleted);
  }

  async setColumns(data: { [key: string]: RowValue }): Promise<void> {
    for (const key of Object.keys(data)) {
      if (!this.isColumn(key)) {
        throw new Error(
          `Column '${key}' does not exist for table ${this.tableName}`
        );
      }
    }

    await this.query.update(data);
    Object.assign(this.rowData, data);
  }

  async setColumn(col: string, value: RowValue): Promise<void> {
    await this.setColumns({ [col]: value });
  }

  async delete(): Promise<void> {
    await this.setColumns({ [this.timeDeletedCol]: this.connection.fn.now() });
  }

  async restore(): Promise<void> {
    await this.setColumns({ [this.timeDeletedCol]: null });
  }

  async deletePermanently(): Promise<void> {
    await this.query.delete();
  }
}

interface FindAllOpts extends SelectOpts {
  pagination?: {
    page?: number;
    limit?: number;
  };
}

export async function findAll<T extends IdType = number>(
  opts: FindAllOpts
): Promise<Row<T>[]> {
  const {
    conn,
    tableName,
    where = null,
    includeDeleted = false,
    includeDeletedCol = TIME_DELETED_COL,
    pagination = null,
    before = null,
  } = opts;

  const query = conn(tableName);

  if (where) {
    query.where(where);
  }

  if (!includeDeleted) {
    query.whereNull(includeDeletedCol);
  }

  if (pagination) {
    const { limit = DEFAULT_PAGINATION_LIMIT, page = 1 } = pagination;
    query.limit(limit).offset((page - 1) * limit);
  }

  if (before) {
    before(query);
  }

  return (await query).map((rowData) => new Row({ tableName, rowData, conn }));
}

export async function find<T extends IdType = number>(
  opts: SelectOpts
): Promise<Row<T>> {
  const [result] = await findAll<T>(opts);
  return result ?? null;
}

interface CountAllOpts extends SelectOpts {
  countBy?: string;
}

export async function countAll(opts: CountAllOpts): Promise<number> {
  const {
    conn,
    tableName,
    where = null,
    includeDeleted = false,
    includeDeletedCol = TIME_DELETED_COL,
    countBy = [ID_COL],
  } = opts;

  const query = conn(tableName);

  if (where) {
    query.where(where);
  }

  if (!includeDeleted) {
    query.whereNull(includeDeletedCol);
  }

  query.count({ count: Array.isArray(countBy) ? countBy : [countBy] });
  const [{ count }] = await query;

  return count;
}

export async function insertAll(
  tableName: string,
  rowData: RowData[],
  opts: ConnectionOpts
): Promise<void> {
  const { conn } = opts;

  await conn(tableName).insert(rowData);
}

export async function insert(
  tableName: string,
  rowData: RowData,
  opts: ConnectionOpts
): Promise<number> {
  const { conn } = opts;

  const [id] = await conn(tableName).insert(rowData);
  return id;
}
