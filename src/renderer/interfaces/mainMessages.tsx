import { ItemRow } from "./items.ts"

export interface MessageMain {
    command: number
    text: string
    returnValue: any
}

export interface MessageItems extends MessageMain {
    returnValue: ItemRow
}

