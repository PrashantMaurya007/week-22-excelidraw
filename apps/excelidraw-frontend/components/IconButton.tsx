import { ReactNode } from "react";

export function IconButton({
    icon, onClick, activated
}: {
    icon: ReactNode,
    onClick: () => void,
    activated: boolean
}) {
    return <div className={`m-2 cursor-pointer rounded-full border p-2 bg-secondary hover:bg-gray-200 active:scale-95 transition-all ${activated ? "text-primary border-primary" : "text-foreground border-transparent"}`} onClick={onClick}>
        {icon}
    </div>
}

