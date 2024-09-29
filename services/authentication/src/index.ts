import express, {Express, urlencoded, json} from 'express'

const application: Express = express();

application.use(urlencoded({extended: true}));

application.use(json());



application.listen(3000, () => {
    console.debug(`Server Is Running At Port ${3000}`);
})