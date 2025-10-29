#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <dlfcn.h>

typedef void (*DisplayServicesSetBrightnessFunc)(CGDirectDisplayID, float);
typedef float (*DisplayServicesGetBrightnessFunc)(CGDirectDisplayID, float*);

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            printf("Usage: %s [get|set <0-100>]\n", argv[0]);
            return 1;
        }
        
        // 动态加载 DisplayServices 框架
        void* handle = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_LAZY);
        if (!handle) {
            fprintf(stderr, "无法加载 DisplayServices 框架\n");
            return 1;
        }
        
        DisplayServicesSetBrightnessFunc setBrightness = (DisplayServicesSetBrightnessFunc)dlsym(handle, "DisplayServicesSetBrightness");
        DisplayServicesGetBrightnessFunc getBrightness = (DisplayServicesGetBrightnessFunc)dlsym(handle, "DisplayServicesGetBrightness");
        
        if (!setBrightness || !getBrightness) {
            fprintf(stderr, "无法找到亮度控制函数\n");
            dlclose(handle);
            return 1;
        }
        
        NSString *command = [NSString stringWithUTF8String:argv[1]];
        CGDirectDisplayID display = CGMainDisplayID();
        
        if ([command isEqualToString:@"get"]) {
            float brightness = 0.0;
            getBrightness(display, &brightness);
            printf("%d\n", (int)(brightness * 100));
        } else if ([command isEqualToString:@"set"] && argc == 3) {
            int level = atoi(argv[2]);
            level = MAX(0, MIN(100, level));
            float brightness = level / 100.0;
            
            setBrightness(display, brightness);
            printf("SUCCESS\n");
        }
        
        dlclose(handle);
    }
    return 0;
}

