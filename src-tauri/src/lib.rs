use tauri::{Manager, WindowEvent, State};
use tauri::tray::TrayIconBuilder;
#[cfg(target_os = "windows")]
use tauri::tray::TrayIconEvent;
use tauri::menu::{Menu, MenuItem};

struct TrayMenuState {
    open_item: MenuItem<tauri::Wry>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            // Set up system tray menu
            let open_item = MenuItem::with_id(app, "open", "Open QC App", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            // Store the open_item in state so we can dynamically change its text
            app.manage(TrayMenuState {
                open_item: open_item.clone(),
            });

            // Set up system tray with default icon if available
            let mut tray_builder = TrayIconBuilder::new();
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            let _tray = tray_builder
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                // Hide the window
                                window.hide().unwrap();
                                #[cfg(target_os = "macos")]
                                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                                
                                // Update menu text to "Open QC App"
                                let state: State<TrayMenuState> = app.state();
                                let _ = state.open_item.set_text("Open QC App");
                            } else {
                                // Show the window
                                #[cfg(target_os = "macos")]
                                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                                
                                window.show().unwrap();
                                window.set_focus().unwrap();
                                
                                // Update menu text to "Close QC App"
                                let state: State<TrayMenuState> = app.state();
                                let _ = state.open_item.set_text("Close QC App");
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|_tray, _event| {
                    #[cfg(target_os = "windows")]
                    if let TrayIconEvent::DoubleClick { button, .. } = _event {
                        if button == tauri::tray::MouseButton::Left {
                            let app = _tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().unwrap();
                                window.set_focus().unwrap();
                                
                                // Update menu text to "Close QC App"
                                let state: State<TrayMenuState> = app.state();
                                let _ = state.open_item.set_text("Close QC App");
                            }
                        }
                    }
                })
                .build(app)?;
                
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                // Prevent window from closing completely
                api.prevent_close();
                // Hide it to the system tray
                window.hide().unwrap();
                
                // Hide dock icon on macOS
                #[cfg(target_os = "macos")]
                let _ = window.app_handle().set_activation_policy(tauri::ActivationPolicy::Accessory);
                
                // Update menu text to "Open QC App"
                let state: State<TrayMenuState> = window.state();
                let _ = state.open_item.set_text("Open QC App");
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| match event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => {
            if let Some(window) = _app_handle.get_webview_window("main") {
                let _ = _app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
                window.show().unwrap();
                let _ = window.set_focus();
                
                // Update menu text to "Close Chuti"
                let state: State<TrayMenuState> = _app_handle.state();
                let _ = state.open_item.set_text("Close Chuti");
            }
        }
        _ => {}
    });
}
