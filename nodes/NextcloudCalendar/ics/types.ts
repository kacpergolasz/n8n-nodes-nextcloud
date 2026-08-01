/** Ordered ICS AST — preserve-unknown for CalDAV round-trips. */

export type IcsParam = {
	name: string;
	value?: string;
};

export type IcsProperty = {
	/** Property name as written (typically uppercase). */
	name: string;
	params: IcsParam[];
	/** Value after the first unquoted colon (escaped form for TEXT props). */
	value: string;
};

export type IcsComponent = {
	/** Component name without BEGIN/END (e.g. VCALENDAR, VEVENT, VALARM). */
	name: string;
	properties: IcsProperty[];
	components: IcsComponent[];
};
