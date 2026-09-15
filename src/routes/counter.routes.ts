import { Router } from "express";
import { CounterController } from "../controllers/counter.controller";
import prisma from "../prisma/client";
import { authenticate, requireCompanyAdmin, requireCompanyUser } from "../middlewares/auth.middleware";

const router = Router();
router.get("/public", async (req,res,next)=>{try{if(typeof req.query.branch_id!=="string")return res.status(400).json({message:"Branch required"});const data=await prisma.counter.findMany({where:{branch_id:req.query.branch_id,is_active:true},select:{id:true,branch_id:true,name_uz:true,name_ru:true,name_en:true,number:true,is_active:true},orderBy:{number:"asc"}});res.json({success:true,data});}catch(e){next(e);}});

// Sessions
router.post("/sessions/open", authenticate, requireCompanyUser, CounterController.openSession);
router.post("/sessions/close", authenticate, requireCompanyUser, CounterController.closeSession);

router.get("/", authenticate, requireCompanyUser, CounterController.list);
router.post("/", authenticate, requireCompanyAdmin, CounterController.create);
router.get("/:id", authenticate, requireCompanyUser, CounterController.findOne);
router.patch("/:id", authenticate, requireCompanyAdmin, CounterController.update);
router.delete("/:id", authenticate, requireCompanyAdmin, CounterController.remove);

// Queue assignment
router.post("/:id/queues", authenticate, requireCompanyAdmin, CounterController.assignQueue);
router.delete("/:id/queues/:queueGroupId", authenticate, requireCompanyAdmin, CounterController.removeQueue);

export const counterRoutes = router;
