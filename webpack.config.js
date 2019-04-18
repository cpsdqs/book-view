module.exports = function (env) {
    const prod = env === 'prod';

    return {
        entry: './src/index',
        mode: prod ? 'production' : 'development',
        devtool: prod ? 'source-map' : 'inline-cheap-source-map',
        module: {
            rules: [
                {
                    test: /\.less$/,
                    use: [
                        { loader: 'style-loader' },
                        { loader: 'css-loader' },
                        { loader: 'less-loader' },
                    ],
                },
            ],
        },
    };
};
