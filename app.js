function loadAssetImage(
    src,
    onLoad,
    basePath
) {
    return new Promise(
        resolve => {
            const image =
                new Image();

            const assetUrl =
                buildAssetPath(
                    src,
                    basePath
                );

            image.onload = () => {
                onLoad(image);
                resolve();
            };

            image.onerror = () => {
                console.error(
                    `Nepodařilo se načíst asset:\n${assetUrl}`
                );

                resolve();
            };

            image.src = assetUrl;
        }
    );
}
