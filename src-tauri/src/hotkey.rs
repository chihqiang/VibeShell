use crate::core;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

fn binding_to_accelerator(b: &core::models::HotkeyBinding) -> Option<String> {
    if b.key.is_empty() {
        return None;
    }
    let mut parts = Vec::new();
    if b.meta {
        parts.push("Super");
    }
    if b.ctrl {
        parts.push("Control");
    }
    if b.alt {
        parts.push("Alt");
    }
    if b.shift {
        parts.push("Shift");
    }
    parts.push(&b.key);
    Some(parts.join("+"))
}

pub fn register_all_global_shortcuts(app: &AppHandle) {
    let gs = app.global_shortcut();
    gs.unregister_all().ok();
    log::info!("[hotkey] registering global shortcuts...");

    if let Ok(config) = core::store::load_hotkeys() {
        for (action, binding) in &config {
            if let Some(accel) = binding_to_accelerator(binding) {
                let action_clone = action.clone();
                let app = app.clone();
                match gs.on_shortcut(accel.as_str(), move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = app.emit("shortcut://action", &action_clone);
                    }
                }) {
                    Ok(()) => {
                        log::info!("[hotkey] registered '{}': {}", action, accel);
                    }
                    Err(e) => log::warn!("[hotkey] failed to register '{}': {}", action, e),
                }
            }
        }
    } else {
        log::warn!("[hotkey] no hotkey config found, skipping registration");
    }
}

#[tauri::command]
pub fn load_hotkeys() -> Result<HashMap<String, core::models::HotkeyBinding>, String> {
    core::store::load_hotkeys()
}

#[tauri::command]
pub fn save_hotkeys(
    app_handle: AppHandle,
    config: HashMap<String, core::models::HotkeyBinding>,
) -> Result<(), String> {
    core::store::save_hotkeys(config)?;
    register_all_global_shortcuts(&app_handle);
    Ok(())
}
