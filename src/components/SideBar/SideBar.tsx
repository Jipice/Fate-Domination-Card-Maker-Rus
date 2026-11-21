"use client";
import React, { useEffect, useState } from "react";
import { IoHome, IoChevronBack, IoChevronForward, IoShapes } from "react-icons/io5";
import { PiDiamondsFourFill } from "react-icons/pi";
import { GiSwordInStone } from "react-icons/gi";
import { FaInfoCircle, FaRegUserCircle, FaRegUser } from "react-icons/fa";
import { IoIosStar } from "react-icons/io";
import { SideBarItem } from "./SideBarItem";

const menuItems = [
  { label: "Главная", icon: PiDiamondsFourFill, link: "" },
  { label: "Призыв слуги", icon: GiSwordInStone, link: "servant-summon" },
  { label: "Жетон мастера", icon: FaRegUserCircle, link: "master-token" },
  { label: "Фигурка мастера", icon: FaRegUser, link: "master-standee" },
  { label: "Коробка мастера", icon: IoShapes, link: "master-box" },
  { label: "Командное Заклинание", icon: IoIosStar, link: "command-seal" },
];

const DEFAULT_WIDTH = 250;
const MIN_WIDTH = 180;
const MAX_WIDTH = 420;
const COLLAPSED_WIDTH = 60;
const WIDTH_KEY = "sidebar-width";
const COLLAPSED_KEY = "sidebar-collapsed";

const clamp = (value: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

export const SideBar = () => {
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [showResponsiveSideBar, setShowResponsiveSideBar] =
    useState<boolean>(false);

  // Restore saved size/state after mount (avoids server/client mismatch).
  useEffect(() => {
    try {
      const savedWidth = Number(localStorage.getItem(WIDTH_KEY));
      if (savedWidth) setWidth(clamp(savedWidth));
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* storage unavailable: keep defaults */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => setWidth(clamp(ev.clientX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setWidth((current) => {
        try {
          localStorage.setItem(WIDTH_KEY, String(current));
        } catch {
          /* ignore */
        }
        return current;
      });
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const panelWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="h-screen shrink-0 relative hidden md:block"
        style={{ width: panelWidth + 12 }}
      >
        <div
          className="fixed top-0 left-0 h-screen bg-[#2b3950] p-2 border-r border-black flex flex-col overflow-hidden"
          style={{ width: panelWidth }}
        >
          <div className="flex items-center gap-1 min-w-0">
            {!collapsed && (
              <h1 className="font-bold flex gap-2 p-1 items-start text-sm select-none min-w-0">
                <IoHome className="shrink-0 mt-0.5" />
                <span className="break-words">Создатель карт Fate/Domination</span>
              </h1>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? "Развернуть меню" : "Свернуть меню"}
              aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
              className={`shrink-0 w-8 h-8 flex items-center justify-center rounded bg-blue-900 hover:bg-blue-700 cursor-pointer ${
                collapsed ? "mx-auto" : "ml-auto"
              }`}
            >
              {collapsed ? <IoChevronForward /> : <IoChevronBack />}
            </button>
          </div>
          <hr className="mt-1 mb-2" />
          <div className="flex flex-col justify-between flex-1 min-h-0">
            <div className="flex flex-col gap-1">
              {menuItems.map(({ label, icon, link }) => (
                <SideBarItem
                  label={label}
                  icon={icon}
                  link={link}
                  collapsed={collapsed}
                  key={link + "-menu-item"}
                />
              ))}
            </div>
            <div>
              <hr className="mt-2 mb-2" />
              <SideBarItem
                icon={FaInfoCircle}
                label="Информация и контакты"
                link="info-contact"
                collapsed={collapsed}
              />
            </div>
          </div>

          {/* Drag handle: drag to resize the panel */}
          {!collapsed && (
            <div
              onPointerDown={startResize}
              title="Потяните, чтобы изменить ширину"
              className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-blue-400/50 active:bg-blue-400/70 z-20"
              role="separator"
              aria-orientation="vertical"
            />
          )}
        </div>
      </div>

      {/* Mobile sidebar (overlay) */}
      {showResponsiveSideBar && (
        <div className="md:hidden fixed top-0 left-0 z-10 mobile-fixed">
          <div
            className="fixed top-0 left-0 h-dvh bg-[#2b3950] p-2 border-r border-black flex flex-col overflow-y-auto"
            style={{ width: DEFAULT_WIDTH }}
          >
            <h1 className="font-bold flex gap-2 p-1 items-center text-sm select-none">
              <IoHome />
              Создатель карт Fate/Domination
            </h1>
            <hr className="mt-1 mb-2" />
            <div className="flex flex-col justify-between flex-1">
              <div className="flex flex-col gap-1">
                {menuItems.map(({ label, icon, link }) => (
                  <SideBarItem
                    label={label}
                    icon={icon}
                    link={link}
                    key={link + "-menu-item"}
                    onNavigate={() => setShowResponsiveSideBar(false)}
                  />
                ))}
              </div>
              <div>
                <hr className="mt-2 mb-2" />
                <SideBarItem
                  icon={FaInfoCircle}
                  label="Информация и контакты"
                  link="info-contact"
                  onNavigate={() => setShowResponsiveSideBar(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <button
          className="fixed w-10 h-10 rounded bg-red-800 right-3 top-3 z-10 cursor-pointer md:hidden"
          onClick={() => setShowResponsiveSideBar((prev) => !prev)}
        >
          {showResponsiveSideBar ? "X" : "O"}
        </button>
      </div>
    </>
  );
};
