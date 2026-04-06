#include <fcntl.h>
#include <sys/inotify.h>
#include <sys/stat.h>
#include <unistd.h>
#include <malloc.h>
#include <cstring>
#include <thread>
#include "zygisk_next_api.h"
#include "log.h"

int fd_to_hookee = -1;

static void onConfigChange() {
    if (fd_to_hookee == -1) return;

    LOGI("trigger config update!");

    struct stat st {};
    if (stat("/data/adb/hyperos_music_haptic_whitelist/config.txt", &st) != 0 || st.st_size == 0) {
        LOGE("Config file empty or not found");
        return;
    }

    int fd = open("/data/adb/hyperos_music_haptic_whitelist/config.txt", O_RDONLY);
    if (fd < 0) return;

    char* buffer = (char*)malloc(st.st_size + 1);
    read(fd, buffer, st.st_size);
    buffer[st.st_size] = '\0';
    close(fd);

    auto size = static_cast<uint32_t>(st.st_size);
    write(fd_to_hookee, &size, sizeof(size));
    write(fd_to_hookee, buffer, size);
    LOGI("configs send to service");

    free(buffer);
}

static void onCompanionLoaded() {
    LOGI("companion loaded");

    std::thread([]() {
        int fd = inotify_init();
        if (fd < 0) {
            LOGE("inotify init failed");
            return;
        }

        int wd = inotify_add_watch(fd, "/data/adb", IN_CLOSE_WRITE | IN_MOVED_TO);
        LOGI("start watching /data/adb");

        char buffer[4096];
        while (true) {
            ssize_t length = read(fd, buffer, sizeof(buffer));
            if (length < 0) break;

            for (char *ptr = buffer; ptr < buffer + length;) {
                auto *event = (struct inotify_event *) ptr;

                if (event->len > 0 && !(event->mask & IN_ISDIR)) {
                    if (strcmp(event->name, "config.txt") == 0) {
                        onConfigChange();
                    }
                }

                ptr += sizeof(struct inotify_event) + event->len;
            }
        }

        close(fd);
    }).detach();
}

static void onModuleConnected(int fd) {
    LOGI("module connected");

    if (fd_to_hookee != -1) {
        close(fd_to_hookee);
    }

    fd_to_hookee = fd;

    // make sure hookee received config
    onConfigChange();
}

__attribute__((visibility("default"), unused))
struct ZygiskNextCompanionModule zn_companion_module = {
        .target_api_version = ZYGISK_NEXT_API_VERSION_1,
        .onCompanionLoaded = onCompanionLoaded,
        .onModuleConnected = onModuleConnected,
};
