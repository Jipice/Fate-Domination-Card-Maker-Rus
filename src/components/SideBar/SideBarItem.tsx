import Link from "next/link";
import React from "react";
import { IconType } from "react-icons/lib";

export const SideBarItem = ({
  label,
  icon,
  link,
  collapsed = false,
  onNavigate,
}: {
  label: string;
  icon: IconType;
  link: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) => {
  const Icon = icon;
  return (
    <Link
      href={`/${link}`}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`font-semibold flex gap-2 p-1 items-center cursor-pointer hover:bg-blue-400 rounded select-none whitespace-nowrap overflow-hidden ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <Icon className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
};
